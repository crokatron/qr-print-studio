import assert from 'node:assert/strict';
import {setupCatalog} from '../site/qr-studio/catalog.js';
import {defaults} from '../site/qr-studio/geometry.js';

// Exercise the catalog controller with delayed API responses and browser history.
const elements=new Map(),events={},windowEvents={},pending=new Map(),calls=[];
const element=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,hidden:false,disabled:false,innerHTML:'',textContent:'',classList:{toggle(){}},querySelectorAll:()=>[],addEventListener(){},replaceChildren(){}});return elements.get(id);};
globalThis.document={body:element('body'),getElementById:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn,hidden:false};
globalThis.window={addEventListener:(name,fn)=>windowEvents[name]=fn};
globalThis.location=new URL('https://example.invalid/qr-studio/?plant=7#tag-editor');
const history=[];globalThis.history={pushState:(_a,_b,url)=>{history.push(String(url));globalThis.location=new URL(url);}};
globalThis.localStorage={getItem:()=>null,setItem(){}};
const interval=globalThis.setInterval;globalThis.setInterval=()=>0;
const plants=[7,8,9,10].map(id=>({id,name:'Plant '+id,scientific_name:'Scientific '+id,qr_url:'https://example.invalid/P/'+id,ha_url:'https://example.invalid/plant-map/plant-'+id,record_url:'https://example.invalid/plants/details/'+id}));
const response=(data,etag='"r1"')=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','ETag':etag}});
globalThis.fetch=async(path,options={})=>{
 calls.push([path,options]);
 if(path.endsWith('/defaults'))return response({settings:{textMode:'label'}});
 if(path.endsWith('/plant-tags'))return response({plants});
 const id=Number(path.split('/').pop());
 if(pending.has(id))return await new Promise(resolve=>pending.set(id,resolve));
 return response({settings:{width:60+id}},'"r'+id+'"');
};
let config={...defaults},ready=false;
await setupCatalog({read:()=>({...config}),fill:c=>config={...c},changed(){},download(){},setLinkedReady:value=>ready=value});
globalThis.setInterval=interval;
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
function click(id,mods={}){let prevented=false;events.click({target:{closest:()=>({href:'https://example.invalid/qr-studio/?plant='+id+'#tag-editor',target:'',hasAttribute:()=>false})},button:0,preventDefault(){prevented=true;},...mods});return prevented;}
assert.equal(config.plantName,'Plant 7');assert(ready);
element('select-all').onclick();element('plant-search').value='Plant';config.width=91;
assert(click(8));await flush();assert.equal(config.plantName,'Plant 8');assert.equal(config.width,68);assert.match(element('batch-count').textContent,/4 selected/);assert.equal(element('plant-search').value,'Plant');
config.width=82;assert(click(7));await flush();assert.equal(config.width,91);assert.equal(config.content,plants[0].qr_url);
assert.equal(calls.filter(([path])=>path.endsWith('/7')).length,1,'Revisited plant uses this visit\'s draft');
globalThis.location=new URL(history[0]);windowEvents.popstate();await flush();assert.equal(config.width,82);assert.equal(config.plantName,'Plant 8');
pending.set(9,true);pending.set(10,true);click(9);click(10);await flush();assert(!ready);
pending.get(10)(response({settings:{width:70}},'"r10"'));await flush();assert.equal(config.plantName,'Plant 10');assert(ready);
pending.get(9)(response({settings:{width:69}},'"r9"'));await flush();assert.equal(config.plantName,'Plant 10','Late response cannot replace latest selection');
assert(!click(7,{ctrlKey:true}),'Modified clicks keep normal new-tab navigation');
pending.delete(10);await element('save-plant').onclick();const put=calls.find(([,o])=>o.method==='PUT');assert(put[0].endsWith('/10'));assert.equal(put[1].headers['If-Match'],'"r10"');assert.equal(JSON.parse(put[1].body).width,70);
assert(!JSON.parse(put[1].body).content,'Plant QR identity is never saved as print settings');
console.log('PASS: in-place plant navigation, retained selection/search/drafts, Back, cached revisits, out-of-order response protection, modified clicks, correct save target and revision.');
