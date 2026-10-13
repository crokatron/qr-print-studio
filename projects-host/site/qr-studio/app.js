import { THREE, OrbitControls } from './vendor.js';

import { defaults, validate } from './geometry.js';

import { stl, threeMF, partZip, materials } from './export.js';

import { decodeFile } from './import.js';

import {setupCatalog,initialDraft,defaultFlag,DRAFT_KEY} from './catalog.js?v=20261009-plant-switch-1';

const $=id=>document.getElementById(id),fields=Object.keys(defaults),downloads=['download-3mf','download-parts','download-stl','download-png','save-design'];

let model=null,busy=false,dirty=true,revision=0,worker=null,timer=null,scheduled=null,importing=false,importId=0,blocked=false,fitNext=true,group=null,renderer,scene,camera,orbit;

let linkedReady=!new URL(location.href).searchParams.has('plant');

const sliders=new Map();

function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}

function buttons(){downloads.forEach(id=>$(id).disabled=!linkedReady||!model||busy||dirty||importing);$('download-fit').disabled=!linkedReady||!model?.fitTest||busy||dirty||importing;$('build').disabled=busy||importing;$('viewport').setAttribute('aria-busy',String(busy||dirty||importing));}

function read(){return Object.fromEntries(fields.map(k=>[k,$(k).value]));}

function updateFields(){$('sticker-fields').hidden=$('textMode').value!=='label';$('stake-fields').hidden=$('style').value==='tag';for(const id of ['flag-side-field','flag-shape-field','flag-shape-hint'])$(id).hidden=$('style').value!=='flag';$('joint-fields').hidden=$('construction').value!=='cross';}

function syncSliders(){for(const [key,slider] of sliders){if($(key).value!==''&&$(key).validity.valid)slider.value=$(key).value;}}

function fill(c){for(const k of fields)$(k).value=c[k];syncSliders();updateFields();}

function cancelImport(){importId++;importing=false;}

function queueBuild(delay=70){if(scheduled!==null)return;scheduled=setTimeout(()=>{scheduled=null;build();},delay);}

function changed(delay=70){revision++;dirty=true;blocked=false;syncSliders();buttons();updateFields();status(importing?'Reading the QR content…':'Updating preview…');if(delay===220){clearTimeout(scheduled);scheduled=null;}queueBuild(delay);}

function addSliders(){for(const key of ['fontSize','width','base','relief','stakeLength','stakeWidth','stakeThickness','clearance']){const input=$(key),label=input.closest('label'),wrap=document.createElement('div'),slider=document.createElement('input');wrap.className='slider-field';label.before(wrap);wrap.append(label);slider.type='range';slider.id=key+'-slider';for(const attr of ['min','max','step'])slider.setAttribute(attr,input.getAttribute(attr));slider.setAttribute('aria-label',label.textContent.trim()+' slider');slider.setAttribute('aria-controls','viewport');input.required=true;wrap.append(slider);sliders.set(key,slider);slider.oninput=()=>{input.value=slider.value;changed();};slider.onchange=()=>build();}}

function saveLocal(c){if(new URL(location.href).searchParams.has('plant'))return;try{localStorage.setItem(DRAFT_KEY,JSON.stringify(c));}catch{}}

function getWorker(){if(!worker){worker=new Worker(new URL('./geometry.worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{clearTimeout(timer);busy=false;if(importing||blocked){buttons();return;}const current=data.id===revision;if(data.error){buttons();if(current)status(data.error,true);else build();return;}

 // Show completed frames during a drag, but only the final revision can be saved or exported.

 if(current||$('settings').checkValidity()){model=data.model;renderModel(fitNext);fitNext=false;}

 dirty=!current;buttons();if(current){saveLocal(model.config);status('Ready to export · preview updates automatically.');}else build();};worker.onerror=()=>{clearTimeout(timer);worker.terminate();worker=null;busy=false;buttons();status('The model engine could not load. Refresh the page and try again.',true);};}return worker;}

function build(){clearTimeout(scheduled);scheduled=null;if(busy||importing||blocked||(!dirty&&model))return;try{const invalid=$('settings').querySelector(':invalid');if(invalid){status('Check '+(invalid.labels?.[0]?.textContent.trim()||'the highlighted value')+': '+invalid.validationMessage,true);return;}const config=validate(read());busy=true;dirty=true;buttons();status('Updating preview…');getWorker().postMessage({id:revision,config});timer=setTimeout(()=>{worker.terminate();worker=null;busy=false;buttons();status('This model took too long. Try shorter labels or a simpler QR destination.',true);},45000);}catch(e){status(e.message,true);}}

function init3d(){try{const box=$('viewport');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,2000);camera.up.set(0,1,0);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));box.append(renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x37533a,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-80,130,250);scene.add(light);orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI*.95;new ResizeObserver(()=>{const w=box.clientWidth,h=box.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}}).observe(box);renderer.setAnimationLoop(()=>{if(!$('viewport').hidden){orbit.update();renderer.render(scene,camera);}});}catch{$('view-3d').disabled=true;$('reset-view').disabled=true;switchView(false);}}

function resetCamera(keepAngle=false){if(!model||!camera||!group)return;const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),direction=camera.position.clone().sub(orbit.target).normalize();orbit.target.copy(center);const extent=Math.max(size.y,size.x/camera.aspect,size.z)*1.9,assembled=$('view-mode').value==='assembled';camera.position.copy(center).add(keepAngle?direction.multiplyScalar(extent*1.12):new THREE.Vector3(extent*(assembled?.55:.08),-extent*.14,extent*(assembled?.95:1)));orbit.update();}

function renderModel(fit=false){

 if(!model.assembly)$('view-mode').value='print';$('view-mode').disabled=!model.assembly;

 if(renderer){const first=!group,previousOutline=group?.userData.outline,outline=model.config.style==='flag'?'flag-'+model.config.flagShape:model.config.style;if(group){scene.remove(group);for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();}}group=new THREE.Group();group.userData.outline=outline;for(const body of model.bodies){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(body.vertices,3));geo.setIndex(new THREE.BufferAttribute(body.indices,1));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:body.color,roughness:.8,metalness:0,flatShading:true}));if($('view-mode').value==='assembled'&&body.assemblyMatrix)mesh.applyMatrix4(new THREE.Matrix4().fromArray(body.assemblyMatrix));group.add(mesh);}scene.add(group);if(first||fit)resetCamera();else if(previousOutline!==outline)resetCamera(true);}

 $('qr-optimisation').textContent=`Print-optimised QR · ${model.qr.size} × ${model.qr.size} squares · each ${model.layout.module.toFixed(2)} mm (${(model.layout.module/model.config.nozzle).toFixed(1)} nozzle widths).${/^HTTPS:\/\/PLANTS\.MUNGOON\.NET\/P\/\d+$/.test(model.config.content)?' Short permanent plant link.':''}`;

 $('name-treatment').textContent=model.config.textMode==='label'?`3D printed QR + blank ${model.config.labelWidth} x ${model.config.labelHeight} mm name-sticker area. Print names separately with a compatible label printer.`:model.config.textMode==='none'?'3D printed QR only.':'QR and names are both 3D printed.';

 drawQR();$('preview-title').textContent=model.config.style==='flag'?({pointed:'Pointed flag',rectangle:'Rectangular flag',triangle:'Triangular flag',circle:'Circular flag'})[model.config.flagShape]:({stake:'Centred plant stake',tag:'Flat plant tag'})[model.config.style];$('dimensions').textContent=`Print: ${model.layout.width.toFixed(0)} × ${model.layout.length.toFixed(0)} × ${model.layout.thickness.toFixed(1)} mm · QR squares ${model.layout.module.toFixed(2)} mm`;

 $('assembly-note').textContent=$('view-mode').value==='assembled'?'Assembled preview only. Downloads keep both pieces flat for printing.':'Downloads use this flat print layout.';

 $('assembly-guide').hidden=!model.assembly;$('download-stl').textContent=model.assembly?'Print layout STL':'Combined STL';

 $('strength-summary').textContent=model.config.style==='tag'?'No spike on this tag.':`Blade: ${model.config.stakeWidth} × ${model.config.stakeThickness} mm · Length: ${model.config.stakeLength} mm · ${model.config.reinforcement==='rounded'?'Rounded':model.config.reinforcement==='flared'?'Flared':'Straight'} neck${model.assembly?' · Material beside each slot: '+model.assembly.sideWall.toFixed(2)+' mm':''}`;

 $('warnings').replaceChildren(...model.warnings.map(w=>{const li=document.createElement('li');li.textContent=w;return li;}));$('warnings').hidden=!model.warnings.length;

 const {slots}=materials(model);$('body-list').replaceChildren(...model.bodies.map((b,i)=>{const item=document.createElement('span');item.className='body-chip';const swatch=document.createElement('i');swatch.className='swatch';swatch.style.backgroundColor=b.color;item.append(swatch,document.createTextNode(`${b.name.slice(3)} · slot ${slots[i]}`));return item;}));

}

function drawQR(){const canvas=$('qr-canvas'),n=model.qr.size,scale=Math.max(8,Math.floor(1000/(n+8)));canvas.width=canvas.height=(n+8)*scale;const ctx=canvas.getContext('2d');ctx.fillStyle=model.config.backColor;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=model.config.qrColor;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(model.qr.data[y*n+x])ctx.fillRect((x+4)*scale,(y+4)*scale,scale,scale);}

function switchView(use3d){$('viewport').hidden=!use3d;$('flat-view').hidden=use3d;$('view-3d').setAttribute('aria-pressed',String(use3d));$('view-flat').setAttribute('aria-pressed',String(!use3d));}

function filename(){return [model.config.genus,model.config.plantName].filter(Boolean).join('-').replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,100)||'plant-qr';}

function download(data,name,type){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}

function exportFile(kind){if(!linkedReady||!model||dirty||busy||importing)return;try{const name=filename();if(kind==='3mf')download(threeMF(model),name+'.3mf','model/3mf');if(kind==='parts')download(partZip(model),name+'-print-kit.zip','application/zip');if(kind==='stl')download(stl(model.combined),name+(model.assembly?'-print-layout.stl':'-combined.stl'),'model/stl');if(kind==='fit'&&model.fitTest)download(stl(model.fitTest),name+'-fit-test.stl','model/stl');if(kind==='png')$('qr-canvas').toBlob(blob=>{if(blob)download(blob,name+'-qr.png','image/png');});if(kind==='json')download(JSON.stringify({app:'qr-print-studio',version:1,config:model.config},null,2),name+'-design.json','application/json');}catch(e){status('Export failed: '+e.message,true);}}

async function importQR(){const file=$('qr-file').files[0];if(!file)return;const token=++importId;importing=true;dirty=true;blocked=false;revision++;clearTimeout(scheduled);scheduled=null;buttons();status('Reading the QR content…');try{const result=await decodeFile(file,Number($('pdf-page').value));if(token!==importId)return;$('content').value=result.content;$('import-status').textContent=result.note;importing=false;changed();build();}catch(e){if(token!==importId)return;importing=false;blocked=true;revision++;clearTimeout(scheduled);scheduled=null;buttons();status(e.message||'Could not read this file.',true);}}

$('settings').onsubmit=e=>{e.preventDefault();dirty=true;blocked=false;build();};addSliders();for(const key of fields)$(key).addEventListener('input',()=>{if(key==='content')cancelImport();changed(['content','genus','plantName'].includes(key)?220:70);});

$('qr-file').onchange=importQR;$('pdf-page').onchange=()=>{if($('qr-file').files.length)importQR();};

$('view-3d').onclick=()=>switchView(true);$('view-flat').onclick=()=>switchView(false);$('reset-view').onclick=()=>resetCamera();

$('view-mode').onchange=()=>{if(model){switchView(true);renderModel(true);}};$('download-fit').onclick=()=>exportFile('fit');

const presets={classic:{style:'stake',construction:'flat',informationLayout:'stacked',rotation:0,stakeThickness:3.2,stakeWidth:16,stakeLength:80,reinforcement:'flared'},flag:{style:'flag',flagSide:'left',flagShape:'rectangle',construction:'flat',informationLayout:'stacked',rotation:0,stakeThickness:2.4,stakeWidth:15,stakeLength:80,reinforcement:'rounded'},cross:{style:'stake',construction:'cross',informationLayout:'stacked',rotation:0,stakeThickness:3.2,stakeWidth:18,stakeLength:90,reinforcement:'flared',clearance:.25},stout:{style:'stake',construction:'flat',informationLayout:'stacked',rotation:0,stakeThickness:4,stakeWidth:20,stakeLength:65,reinforcement:'flared'}};

document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{cancelImport();fitNext=true;fill({...read(),...presets[button.dataset.preset]});changed();build();});

for(const kind of ['3mf','parts','stl','png'])$('download-'+kind).onclick=()=>exportFile(kind);$('save-design').onclick=()=>exportFile('json');

$('design-file').onchange=async()=>{const file=$('design-file').files[0];try{if(!file||file.size>64000)throw Error('Choose a QR Studio design JSON smaller than 64 KB.');const data=JSON.parse(await file.text());if(data.app!=='qr-print-studio'||data.version!==1||!data.config)throw Error('This is not a QR Studio design file.');const c=validate(data.config);cancelImport();fitNext=true;fill(c);changed();build();}catch(e){status(e.message,true);}finally{$('design-file').value='';}};

let start={config:defaults,legacy:null};try{start=initialDraft(localStorage);}catch{}fill(start.config);init3d();build();

const linked=new URL(location.href).searchParams.has('plant');

$('restore-previous').hidden=linked||!start.legacy;

$('draft-note').textContent=!linked&&start.legacy?'Started with the updated default. Your previous browser design is preserved and can be restored.':'';

$('use-default-flag').onclick=()=>{cancelImport();fitNext=true;fill(defaultFlag(read()));changed();build();$('draft-note').textContent=linked?'Default flag applied to this preview. Save this plant’s print settings to keep it on the NAS.':'Updated default flag applied.';};

$('restore-previous').onclick=()=>{if(!start.legacy)return;cancelImport();fitNext=true;fill(start.legacy);changed();build();$('draft-note').textContent='Previous browser design restored. Use default flag to switch to the new layout.';};



setupCatalog({read,fill,changed,download,applyConfig(config){cancelImport();fitNext=true;fill(config);changed();build();},setLinkedReady(value){linkedReady=value;buttons();}});

