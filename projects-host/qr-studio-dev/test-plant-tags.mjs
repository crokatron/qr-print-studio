import fs from 'node:fs/promises';

import assert from 'node:assert/strict';

const original=globalThis.fetch;

globalThis.fetch=async(url,...args)=>String(url).startsWith('file:')?new Response(await fs.readFile(new URL(url)),{headers:{'Content-Type':String(url).endsWith('.wasm')?'application/wasm':'application/json'}}):original(url,...args);

const {buildModel,defaults}=await import('../site/qr-studio/geometry.js');

const {packPlates,batch3MF}=await import('../site/qr-studio/batch.js');

const {linkedConfig,printSettings}=await import('../site/qr-studio/catalog.js');

const {jsQR,unzipSync,strFromU8}=await import('../site/qr-studio/vendor.js');

function closed(mesh){const edges=new Map();for(let i=0;i<mesh.indices.length;i+=3){const p=mesh.indices.slice(i,i+3);for(let j=0;j<3;j++){const a=p[j],b=p[(j+1)%3],key=a<b?a+','+b:b+','+a,row=edges.get(key)||[0,0];row[0]++;row[1]+=a<b?1:-1;edges.set(key,row);}}assert([...edges.values()].every(([n,d])=>n===2&&d===0),'Watertight oriented mesh');assert(mesh.volume>0);}

function decode(m){const scale=10,size=(m.qr.size+8)*scale,data=new Uint8ClampedArray(size*size*4).fill(255);for(let y=0;y<m.qr.size;y++)for(let x=0;x<m.qr.size;x++)if(m.qr.data[y*m.qr.size+x])for(let v=0;v<scale;v++)for(let u=0;u<scale;u++){const i=(((y+4)*scale+v)*size+(x+4)*scale+u)*4;data[i]=data[i+1]=data[i+2]=0;}assert.equal(jsQR(data,size,size).data,m.config.content);}

const models=[];

for(const nozzle of [.2,.4,.6,.8,1]){const m=await buildModel({...defaults,width:30,nozzle,content:'https://example.invalid/P/20'});assert(m.layout.module+1e-8>=nozzle*2);assert.equal(m.layout.bounds.min[0],0);assert.equal(m.layout.pole,m.config.stakeWidth/2);for(const b of [...m.bodies,m.combined])closed(b);decode(m);assert(Math.abs(m.bodies.reduce((n,b)=>n+b.volume,0)-m.combined.volume)<.01);models.push(m);}

for(const flagShape of ['rectangle','circle','triangle','pointed'])for(const rotation of [0,90,180,270]){const m=await buildModel({...defaults,flagShape,rotation,content:'https://example.invalid/P/4'});closed(m.combined);decode(m);}

for(const flagSide of ['left','right']){const rounded=await buildModel({...defaults,flagSide}),flared=await buildModel({...defaults,flagSide,reinforcement:'flared'});closed(rounded.combined);assert.notEqual(rounded.combined.volume,flared.combined.volume);const v=rounded.bodies[0].vertices,arc=new Set();for(let i=0;i<v.length;i+=3)if(v[i+1]<0&&v[i+1]>-7.5&&v[i+2]===0)arc.add(v[i+1].toFixed(4));assert(arc.size>=12,'Rounded join must contain a smooth sampled arc');}

const longLabel=await buildModel({...defaults,textMode:'raised',genus:'Alocasia × amazonica',plantName:'Amazonian alocasia (Polly type)',fontSize:3});assert(longLabel.config.fontSize>=8);assert(longLabel.layout.labels.length>2);assert(longLabel.layout.labels.every(l=>l.fontSize>=8&&l.height>=4));assert.equal(longLabel.layout.labels.filter(l=>l.kind==='Genus').map(l=>l.text).join(' '),'Alocasia × amazonica');closed(longLabel.combined);

const cross=await buildModel({...defaults,style:'stake',construction:'cross'});closed(cross.combined);closed(cross.fitTest);

const sample=Array.from({length:34},(_,i)=>({...models[1],config:{...models[1].config,plantName:'Plant '+(i+1)}}));

const {data,plan}=batch3MF(sample);assert(plan.count>1);

for(const p of plan.placements){assert(p.x>=8&&p.y>=32&&p.x+p.w<=248&&p.y+p.h<=248);assert(!(p.x<248&&p.x+p.w>204&&p.y<248&&p.y+p.h>204),'Purge clearance');for(const q of plan.placements.filter(q=>q.index<p.index&&q.plate===p.plate))assert(!(p.x<q.x+q.w&&p.x+p.w>q.x&&p.y<q.y+q.h&&p.y+p.h>q.y),'No overlapping tags');}

assert.throws(()=>packPlates([{layout:{width:300,length:300},config:{}}]),/does not fit/);

const zip=unzipSync(data),xml=new TextDecoder().decode(zip['Metadata/model_settings.config']);assert.equal((xml.match(/<plate>/g)||[]).length,plan.count);assert.equal((xml.match(/<model_instance>/g)||[]).length,34);assert.match(xml,/key="extruder" value="2"/);

const p={name:'Corrected name · Hall',scientific_name:'Scientific correction',qr_url:'https://example.invalid/P/8'},config=linkedConfig(p,{width:75});assert.equal(config.genus,p.scientific_name);assert.equal(config.plantName,'Corrected name');assert.equal(config.content,p.qr_url);assert.equal(config.width,75);assert(!('content' in printSettings(config)));assert(!('plantName' in printSettings(config)));

await fs.mkdir(new URL('../../outputs/qr-studio/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../../outputs/qr-studio/plant-batch-test.3mf',import.meta.url),data);

console.log('PASS: 5 nozzles, 16 flag/rotation combinations, cross fit, QR decode, closed meshes, canonical labels, 34 tags across '+plan.count+' plates.');



for(const textMode of ["label","none"]){const m=await buildModel({...defaults,textMode,labelWidth:70,labelHeight:18});closed(m.combined);decode(m);assert.equal(m.layout.labels.length,0);assert(!m.bodies.some(b=>b.name==="Lettering"));if(textMode==="label")assert(m.layout.width>=74);}



const defaultPlant=await buildModel(linkedConfig({name:"Amazonian alocasia (Polly type)",scientific_name:"Alocasia amazonica",qr_url:"https://example.invalid/P/36"}));assert.equal(defaultPlant.config.textMode,"label");assert.equal(defaultPlant.layout.labels.length,0);assert.equal(defaultPlant.layout.labelHeight,19);closed(defaultPlant.combined);decode(defaultPlant);assert.equal(defaultPlant.bodies.length,2,"Default has backing and QR, no printed letters");

