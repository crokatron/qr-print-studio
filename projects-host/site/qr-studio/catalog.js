import {labelDefaults,validateLabel,buildLabel,drawLabel,labelsPDF,labelsXLSX} from './labels.js';

import {defaults,validate} from './geometry.js';

import {batch3MF} from './batch.js';

const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const DRAFT_KEY='community-qr-print-v1';

export function initialDraft(storage){

 let legacy=null;try{const saved=storage.getItem(DRAFT_KEY);if(saved)return {config:validate(JSON.parse(saved)),legacy};}catch{}

 try{const saved=storage.getItem('mungoon-qr-print-v2')||storage.getItem('mungoon-qr-print-v1');if(saved)legacy=validate(JSON.parse(saved));}catch{}

 return {config:{...defaults},legacy};

}

export function defaultFlag(config,template=defaults){return {...defaults,...template,style:'flag',...Object.fromEntries(['content','genus','plantName','nozzle','backColor','qrColor','textColor'].map(k=>[k,config[k]??defaults[k]]))};}

export function linkedConfig(plant,settings={},template={}){

 return {...defaults,...template,...settings,content:plant.qr_url,genus:plant.scientific_name||'',plantName:plant.name.split(' · ')[0]};

}

export function printSettings(config){const {content,genus,plantName,...settings}=config;return settings;}

async function request(path,options={}){const r=await fetch('/api/admin/plant-tags'+path,{cache:'no-store',...options});let data;try{data=await r.json();}catch{throw Error('Sign in to Mungoon Projects to load your plant collection.');}if(!r.ok)throw Error(data.error||'Could not load plants.');return {data,etag:r.headers.get('X-Project-Revision')||r.headers.get('ETag')?.replace(/^W\//,'')};}

function generate(config){return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./geometry.worker.js',import.meta.url),{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('A tag took too long to build. Shorten its labels or reduce QR density.'));},60000);worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(Error(data.error)):resolve(data.model);};worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('The model engine could not load.'));};worker.postMessage({id:1,config});});}

// Draw the actual exported meshes from above, including outlines, lettering and cross blades.

export function drawTagPreview(canvas,model){

 const ctx=canvas.getContext('2d'),{min,max}=model.layout.bounds,w=max[0]-min[0],h=max[1]-min[1];

 const scale=Math.min((canvas.width-32)/w,(canvas.height-32)/h),ox=(canvas.width-w*scale)/2,oy=(canvas.height-h*scale)/2;

 ctx.clearRect(0,0,canvas.width,canvas.height);

 for(const body of model.bodies){ctx.fillStyle=body.color;ctx.beginPath();const v=body.vertices,t=body.indices;

  for(let i=0;i<t.length;i+=3){const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;

   // Upward-facing triangles only: sides project to lines and underside faces are hidden.

   if((v[b]-v[a])*(v[c+1]-v[a+1])-(v[b+1]-v[a+1])*(v[c]-v[a])<=1e-9)continue;

   ctx.moveTo(ox+(v[a]-min[0])*scale,oy+(max[1]-v[a+1])*scale);

   ctx.lineTo(ox+(v[b]-min[0])*scale,oy+(max[1]-v[b+1])*scale);

   ctx.lineTo(ox+(v[c]-min[0])*scale,oy+(max[1]-v[c+1])*scale);ctx.closePath();

  }ctx.fill();

 }

}

export async function setupCatalog({read,fill,changed,download,applyConfig=config=>{fill(config);changed();},setLinkedReady=()=>{}}){
 return; // Community edition has no authenticated plant-catalog service.


 const $=id=>document.getElementById(id),selected=new Set(),drafts=new Map();let pid=Number(new URL(location.href).searchParams.get('plant')),selectionRun=0;const unlinkedDraft=read();let plants=[],current,etag,exporting=false,loaded=false,previewing=false,previewRun=0,defaultSettings={},defaultEtag;

 const note=(text,error=false)=>{$('catalog-status').textContent=text;$('catalog-status').classList.toggle('error',error);};

 function lock(){for(const id of ['content','genus','plantName'])$(id).readOnly=!!pid;for(const id of ['qr-file','design-file'])$(id).disabled=!!pid;}

 function list(){const query=$('plant-search').value.toLowerCase(),matches=plants.filter(p=>(p.name+' '+(p.scientific_name||'')).toLowerCase().includes(query));$('plant-total').textContent=plants.length?'('+plants.length+')':'';$('plant-matches').textContent=matches.length+' of '+plants.length+' plants';$('plant-list').innerHTML=matches.map(p=>`<div class="plant-tag-row ${p.id===pid?'active':''}"><label><input type="checkbox" value="${p.id}" ${selected.has(p.id)?'checked':''} aria-label="Select ${E(p.name)} for batch"></label><a href="?plant=${p.id}#tag-editor"><strong>${E(p.name)}</strong><small>${E(p.scientific_name||'Scientific name awaiting confirmation')}</small></a></div>`).join('')||'<p>No plants match your search.</p>';$('batch-count').textContent=selected.size+' selected';$('batch-export').disabled=exporting||previewing||!selected.size;$('label-xlsx-export').disabled=exporting||previewing||!selected.size;$('preview-selected').disabled=exporting||previewing||!selected.size;$('plant-list').querySelectorAll('input').forEach(box=>box.onchange=()=>{box.checked?selected.add(Number(box.value)):selected.delete(Number(box.value));invalidatePreviews();list();});}

 function showPlant(){

  $('linked-plant').innerHTML=current?`<strong>${E(current.name)}</strong> · <a href="${E(current.ha_url)}" target="_blank" rel="noopener">Inspect in HA ↗</a> · <a href="${E(current.record_url)}" target="_blank" rel="noopener">Edit name / photo in Plant Manager ↗</a>`:'Choose a plant to print its permanent HA care link.';

  $('draft-note').textContent='Switch plants without losing your preview edits during this visit. Save this plant’s print settings to keep them on the NAS.';

 }

 async function selectPlant(next,{historyMode='push'}={}){

  if(next===pid&&loaded)return;

  if(loaded)drafts.set(pid,{settings:printSettings(read()),etag});

  const run=++selectionRun;pid=next;loaded=false;current=plants.find(p=>p.id===pid);etag=null;

  setLinkedReady(false);$('save-plant').disabled=true;$('save-plant').hidden=!pid;$('restore-previous').hidden=true;lock();list();showPlant();invalidatePreviews();

  if(historyMode==='push'){const url=new URL(location.href);pid?url.searchParams.set('plant',pid):url.searchParams.delete('plant');url.hash='tag-editor';history.pushState(null,'',url);}

  try{

   if(pid&&!current)throw Error('This plant is no longer available. Choose a plant from the collection.');

   note(current?'Loading '+current.name+'…':'Opening your unlinked design…');

   const saved=drafts.get(pid)||(pid?await request('/'+pid):{settings:printSettings(unlinkedDraft)});

   if(run!==selectionRun)return;

   etag=saved.etag;fill(pid?linkedConfig(current,saved.data?.settings||saved.settings,defaultSettings):{...unlinkedDraft,...saved.settings});loaded=true;changed();setLinkedReady(true);$('save-plant').disabled=!pid;

   note(current?current.name+' · ready. Preview edits stay with each plant during this visit.':plants.length+' plant entries ready.');

  }catch(e){if(run!==selectionRun)return;note(e.message,true);setLinkedReady(false);}

 }

 document.addEventListener('click',event=>{

  const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;

  const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!==location.pathname||!url.searchParams.has('plant'))return;

  const next=Number(url.searchParams.get('plant'));if(!Number.isInteger(next)||next<1)return;

  event.preventDefault();void selectPlant(next);

 });

 window.addEventListener('popstate',()=>{void selectPlant(Number(new URL(location.href).searchParams.get('plant')),{historyMode:'none'});});

 async function refresh(initial=false){const run=selectionRun;try{

  const [result,template]=await Promise.all([request(''),request('/defaults')]);defaultSettings=template.data.settings;defaultEtag=template.etag;$('apply-default-flag').disabled=false;plants=result.data.plants;for(const id of selected)if(!plants.some(p=>p.id===id))selected.delete(id);list();

  if(run!==selectionRun)return;

  if(pid){if(initial||!loaded)await selectPlant(pid,{historyMode:'none'});else{current=plants.find(p=>p.id===pid);if(!current)throw Error('This plant is no longer available. Choose a plant from the collection.');const before=read(),next=linkedConfig(current,printSettings(before));if(['content','genus','plantName'].some(k=>before[k]!==next[k])){fill(next);changed();}showPlant();}}

  else if(initial){fill({...read(),...defaultSettings});changed();loaded=true;}

 }catch(e){if(run!==selectionRun)return;note(e.message,true);if(pid){$('save-plant').disabled=true;setLinkedReady(false);}}}

 $('plant-search').oninput=list;$('select-all').onclick=()=>{plants.forEach(p=>selected.add(p.id));invalidatePreviews();list();};$('select-matching').onclick=()=>{plants.filter(p=>(p.name+' '+(p.scientific_name||'')).toLowerCase().includes($('plant-search').value.toLowerCase())).forEach(p=>selected.add(p.id));invalidatePreviews();list();};$('clear-selection').onclick=()=>{selected.clear();invalidatePreviews();list();};$('refresh-plants').onclick=()=>refresh(!loaded);

 function invalidatePreviews(){previewRun++;previewing=false;$('cancel-previews').hidden=true;if(!$('batch-previews').hidden)$('preview-status').textContent='Selection or settings changed. Preview selected tags again to update this view.';}

 $('cancel-previews').onclick=()=>{invalidatePreviews();$('preview-status').textContent='Preview generation cancelled. Completed previews remain below.';list();};

 $('settings').addEventListener('input',()=>{invalidatePreviews();list();});

 for(const button of document.querySelectorAll('[data-preset],#use-default-flag,#restore-previous'))button.addEventListener('click',()=>{invalidatePreviews();list();});

 const labelMode=()=>$('print-mode').value==='label';

 const labelInput=()=>Object.fromEntries(Object.keys(labelDefaults).map(k=>[k,k==='scientific'?$('label-'+k).checked:$('label-'+k).value]));

 try{const saved=JSON.parse(localStorage.getItem('mungoon-label-printer-v1')||'null');if(saved)for(const k of Object.keys(labelDefaults)){if(k==='scientific')$('label-'+k).checked=!!saved[k];else $('label-'+k).value=saved[k]??labelDefaults[k];}}catch{}

 function mode(){const on=labelMode();try{localStorage.setItem('mungoon-print-mode',on?'label':'stake');}catch{}document.body.classList.toggle('label-mode',on);$('label-settings').hidden=!on;$('label-xlsx-export').hidden=!on;$('batch-export').textContent=on?'Download labels · PDF':'Export selected · X1C plates 3MF';$('preview-selected').textContent=on?'Preview selected labels':'Preview selected tags';invalidatePreviews();list();}

 $('print-mode').onchange=mode;try{if(localStorage.getItem('mungoon-print-mode')==='label')$('print-mode').value='label';}catch{}mode();

 $('label-settings').addEventListener('input',()=>{try{localStorage.setItem('mungoon-label-printer-v1',JSON.stringify(labelInput()));}catch{}invalidatePreviews();list();});

 async function labelModels(){const fresh=(await request('')).data.plants,config=labelInput(),models=[];for(const id of [...selected]){const plant=fresh.find(p=>p.id===id);if(!plant)throw Error('A selected plant was removed. Refresh the collection.');try{models.push(await buildLabel(plant,config));}catch(e){throw Error(plant.name+': '+e.message);}}return models;}

 async function exportLabels(excel=false){if(exporting||!selected.size)return;exporting=true;list();try{note('Preparing printer labels…');if(excel){const fresh=(await request('')).data.plants,rows=[...selected].map(id=>fresh.find(p=>p.id===id));if(rows.some(p=>!p))throw Error('A plant was removed. Refresh the collection.');download(labelsXLSX(rows),'plant-names-NIIMBOT.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');note(`${rows.length} names in one Excel file. In NIIMBOT choose Excel batch import, bind Plant name to one text box, select all rows and print. Set label size and padding in that template once.`);return;}const models=await labelModels();download(labelsPDF(models),'plant-name-labels.pdf','application/pdf');note(`${models.length} labels exported · ${models[0].config.width} × ${models[0].config.height} mm. One name-only label per page. Import this PDF at the matching label size and print all pages.`);}catch(e){note(e.message,true);}finally{exporting=false;list();}}

 $('use-name-stickers').onclick=()=>{try{const c=validateLabel(labelInput());applyConfig({...read(),textMode:'label',labelWidth:c.width,labelHeight:c.height,informationLayout:'stacked'});$('print-mode').value='stake';mode();$('draft-note').textContent='QR stays 3D printed; a blank area fits your name sticker. Apply as default flag to keep this layout for future plants.';}catch(e){note(e.message,true);}};

 $('label-xlsx-export').onclick=()=>exportLabels(true);

 async function previewLabels(){if(previewing||exporting||!selected.size)return;const run=++previewRun;previewing=true;list();$('batch-previews').hidden=false;$('preview-grid').replaceChildren();$('preview-status').textContent='Preparing label previews…';try{const models=await labelModels();if(run!==previewRun)return;for(const m of models){const card=document.createElement('article');card.className='tag-preview-card label-preview';card.innerHTML=`<h3>${E(m.plant.name)}</h3><canvas role="img" aria-label="Label preview for ${E(m.plant.name)}"></canvas><p class="tag-preview-detail">${m.config.width} × ${m.config.height} mm · ${m.config.padding} mm padding · ${m.config.dpi} dpi · name only</p><p>${E(m.warnings.join(' '))}</p>`;drawLabel(card.querySelector('canvas'),m,true);$('preview-grid').append(card);}$('preview-status').textContent=`${models.length} label previews ready. One PDF prints this whole batch. Labels contain names only; QR codes remain on your 3D printed stakes.`;}catch(e){$('preview-status').textContent=e.message;}finally{if(run===previewRun){previewing=false;list();}}}

 $('preview-selected').onclick=async()=>{

  if(labelMode())return previewLabels();

  if(previewing||exporting||!selected.size)return;const run=++previewRun,ids=[...selected],snapshot=read(),previewPid=pid,template={...defaultSettings};previewing=true;list();$('cancel-previews').hidden=false;$('batch-previews').hidden=false;$('preview-grid').replaceChildren();

  const status=text=>{if(run===previewRun)$('preview-status').textContent=text;};let completed=0,failed=0;

  try{status('Loading current plant details…');const fresh=(await request('')).data.plants;if(run!==previewRun)return;

   for(const id of ids){const plant=fresh.find(p=>p.id===id),card=document.createElement('article');card.className='tag-preview-card';card.innerHTML=`<h3>${E(plant?.name||'Removed plant')}</h3><canvas width="480" height="600" role="img" aria-label="Print preview for ${E(plant?.name||'removed plant')}"></canvas><p class="tag-preview-detail">Waiting…</p><a href="?plant=${id}#tag-editor">Edit this tag</a>`;$('preview-grid').append(card);

    status(`Building ${completed+failed+1} of ${ids.length} previews…`);

    try{if(!plant)throw Error('Plant no longer available');const saved=await request('/'+id);if(run!==previewRun)return;const config=validate({...linkedConfig(plant,id===previewPid?printSettings(snapshot):saved.data.settings,template),nozzle:snapshot.nozzle,textMode:snapshot.textMode,labelWidth:snapshot.labelWidth,labelHeight:snapshot.labelHeight});const model=await generate(config);if(run!==previewRun)return;drawTagPreview(card.querySelector('canvas'),model);card.querySelector('.tag-preview-detail').textContent=`${model.layout.width.toFixed(0)} × ${model.layout.length.toFixed(0)} mm · ${config.textMode==='raised'?'letters '+model.config.fontSize.toFixed(1)+' mm':config.textMode==='label'?'blank sticker area '+config.labelWidth+' × '+config.labelHeight+' mm':'QR only'} · ${model.qr.size} × ${model.qr.size} QR · squares ${model.layout.module.toFixed(2)} mm · ${config.content}`;completed++;}

    catch(e){if(run!==previewRun)return;card.querySelector('.tag-preview-detail').textContent=e.message;card.classList.add('error');failed++;}

   }status(`${completed} of ${ids.length} previews ready${failed?' · '+failed+' could not be built':''} · ${snapshot.nozzle} mm nozzle. These show the same flat models used for export.`);

  }catch(e){status(e.message);}finally{if(run===previewRun){previewing=false;$('cancel-previews').hidden=true;list();}}

 };

 $('use-default-flag').onclick=()=>{applyConfig(defaultFlag(read(),defaultSettings));invalidatePreviews();list();$('draft-note').textContent='Default flag applied to this preview. Save this plant’s settings to keep it, or Apply as default flag to update the shared default.';};

 $('apply-default-flag').onclick=async()=>{if(!defaultEtag)return;try{$('apply-default-flag').disabled=true;const config=validate({...read(),style:'flag'}),saved=await request('/defaults',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':defaultEtag},body:JSON.stringify(printSettings(config))});defaultSettings=saved.data.settings;defaultEtag=saved.etag;applyConfig(config);invalidatePreviews();list();$('draft-note').textContent='Default flag saved on the NAS for all your devices. Plants without custom print settings use it; saved custom tags are preserved.';}catch(e){$('draft-note').textContent=e.message;}finally{$('apply-default-flag').disabled=false;}};

 $('save-plant').hidden=!pid;$('save-plant').onclick=async()=>{if(!loaded||!pid)return;const target=pid,revision=etag,settings=printSettings(validate(read()));try{$('save-plant').disabled=true;const saved=await request('/'+target,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':revision},body:JSON.stringify(settings)});const cached=drafts.get(target);if(cached)drafts.set(target,{...cached,etag:saved.etag});if(pid===target&&loaded){etag=saved.etag;note('Print settings saved on the NAS. Names and photos continue to follow Plant Manager.');}}catch(e){note('Could not save plant '+target+': '+e.message,true);}finally{if(pid===target&&loaded)$('save-plant').disabled=false;}};

 $('batch-export').onclick=async()=>{if(labelMode())return exportLabels();if(exporting||!selected.size)return;exporting=true;list();const snapshot=read(),batchPid=pid,ids=[...selected],template={...defaultSettings};try{const fresh=(await request('')).data.plants,models=[],nozzle=snapshot.nozzle;for(const [i,id] of ids.entries()){const plant=fresh.find(p=>p.id===id);if(!plant)throw Error('A selected plant was removed. Refresh the collection.');note(`Building ${i+1} of ${ids.length}: ${plant.name}`);const saved=await request('/'+id),settings=id===batchPid?printSettings(snapshot):saved.data.settings;models.push(await generate(validate({...linkedConfig(plant,settings,template),nozzle,textMode:snapshot.textMode,labelWidth:snapshot.labelWidth,labelHeight:snapshot.labelHeight})));}const {data,plan}=batch3MF(models);download(data,'plant-stakes-X1C-'+plan.count+'-plates.3mf','model/3mf');note(`${models.length} tags exported in one file across ${plan.count} X1C plates · ${nozzle} mm nozzle. Check filament mapping and slice before printing.`);}catch(e){note(e.message,true);}finally{exporting=false;list();}};

 lock();await refresh(true);setInterval(()=>{if(!exporting&&!previewing&&!document.hidden)refresh();},60000);

}

