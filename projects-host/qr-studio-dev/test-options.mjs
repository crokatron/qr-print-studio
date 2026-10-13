import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
const root=resolve(import.meta.dirname,'../site'),out=resolve(import.meta.dirname,'../../outputs/qr-studio/options');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Ready')||document.getElementById('status').classList.contains('error'),{},{timeout:60000});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/qr-studio/`);await ready();
 const results=await page.evaluate(async()=>{
  const {buildModel,defaults,validate}=await import('./geometry.js'),{jsQR,ManifoldModule}=await import('./vendor.js');
  const m=await ManifoldModule({locateFile:()=>new URL('./manifold.wasm',location.href).href});m.setup();
  const cases=[];
  for(const style of ['stake','flag','tag'])for(const rotation of [0,90,180,270])cases.push({...defaults,style,rotation,informationLayout:'side',stakeThickness:3.2,construction:style==='tag'?'flat':'cross',flagSide:rotation<180?'left':'right'});
  cases.push({...defaults,construction:'cross',stakeLength:30,stakeWidth:12,stakeThickness:3,clearance:.1,width:30}, {...defaults,construction:'cross',stakeLength:180,stakeWidth:30,stakeThickness:8,clearance:.8}, {...defaults,style:'flag',flagSide:'right',construction:'cross',genus:'',plantName:'',base:6,stakeThickness:2.4}, {...defaults,style:'flag',flagSide:'left',informationLayout:'side',plantName:'Borsigiana albo variegata',stakeThickness:4});
  function inspect(mesh){const edges=new Map(),adj=new Map(),v=mesh.vertices,t=mesh.indices;let volume=0;for(let i=0;i<t.length;i+=3){let p=t.slice(i,i+3);for(let j=0;j<3;j++){const a=p[j],b=p[(j+1)%3],key=a<b?a+','+b:b+','+a;const row=edges.get(key)||[0,0];row[0]++;row[1]+=a<b?1:-1;edges.set(key,row);if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}const [a,b,c]=Array.from(p,i=>v.slice(i*3,i*3+3));volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
   let components=0;const seen=new Set();for(const v of adj.keys()){if(seen.has(v))continue;components++;const queue=[v];while(queue.length){const x=queue.pop();if(seen.has(x))continue;seen.add(x);queue.push(...adj.get(x).filter(x=>!seen.has(x)));}}
   return {closed:[...edges.values()].every(([n,d])=>n===2&&d===0),volume,expected:mesh.volume,components};}
  const rows=[];
  for(const c of cases){
   const model=await buildModel(c),meshes=[...model.bodies,model.combined,...(model.fitTest?[model.fitTest]:[])],checks=meshes.map(inspect);
   // Decode a raster of the ACTUAL exported QR top faces, not its input matrix.
   const qr=model.bodies.find(b=>b.name==='02 QR code'),canvas=document.createElement('canvas'),scale=12;canvas.width=Math.ceil(model.layout.plateW*scale);canvas.height=Math.ceil(model.layout.plateH*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
   ctx.beginPath();for(let i=0;i<qr.indices.length;i+=3){const p=Array.from(qr.indices.slice(i,i+3),j=>Array.from(qr.vertices.slice(j*3,j*3+3)));if(!p.every(v=>Math.abs(v[2]-c.base-c.relief)<.0001))continue;p.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p[0]*scale,canvas.height-p[1]*scale));ctx.closePath();}ctx.fill();
   const image=ctx.getImageData(0,0,canvas.width,canvas.height),decoded=jsQR(image.data,image.width,image.height);
   let maxCollision=0;
   if(model.assembly){const mesh=body=>new m.Manifold(new m.Mesh({numProp:3,vertProperties:body.vertices,triVerts:body.indices}));const a=mesh(model.bodies[0]),b=mesh(model.bodies.at(-1)),rot=b.rotate([0,90,0]),pose=rot.translate([model.assembly.pole-c.stakeThickness/2,0,model.assembly.printX+c.stakeThickness/2]);for(const dy of [-c.stakeLength,-c.stakeLength/2,-8,-1,0]){const moving=pose.translate([0,dy,0]),intersection=m.Manifold.intersection(a,moving);maxCollision=Math.max(maxCollision,intersection.isEmpty()?0:intersection.volume());moving.delete();intersection.delete();}a.delete();b.delete();rot.delete();pose.delete();}
   rows.push({style:c.style,rotation:c.rotation,cross:!!model.assembly,checks,decoded:decoded?.data,maxCollision,parts:model.bodies.length,volumeDifference:Math.abs(model.bodies.reduce((s,b)=>s+b.volume,0)-model.combined.volume),thickness:model.layout.thickness,raster:canvas.toDataURL()});
  }
  let invalidRejected=false;try{validate({...defaults,construction:'cross',stakeWidth:8,stakeThickness:6});}catch{invalidRejected=true;}
  const old={content:defaults.content,genus:'Old',plantName:'Plant',base:4,style:'stake'},migrated=validate(old);
  return {rows,invalidRejected,migration:migrated.stakeThickness===4&&migrated.reinforcement==='straight'};
 });
 for(const [index,row] of results.rows.entries()){await writeFile(out+'/raster-'+index+'.png',Buffer.from(row.raster.split(',')[1],'base64'));delete row.raster;for(const check of row.checks){assert(check.closed,JSON.stringify(row));assert(check.volume>0);assert(Math.abs(check.volume-check.expected)<.06);}assert.equal(row.decoded,'https://example.invalid/',`QR geometry scan: ${row.style} ${row.rotation}`);assert(row.volumeDifference<.01);assert(row.maxCollision<.001);assert.equal(row.checks[0].components,1,'Main backing and spike must remain connected');if(row.cross){assert.equal(row.checks[row.parts-1].components,1,'Cross blade must be connected');assert.equal(row.checks[row.parts].components,2,'Print layout must have two physical pieces');assert.equal(row.checks.at(-1).components,2,'Fit test must have two coupons');}}
 assert(results.invalidRejected);assert(results.migration);await writeFile(out+'/geometry-checks.json',JSON.stringify(results,null,2));
 await page.getByRole('button',{name:'Flag tag',exact:false}).click();await ready();assert.match(await page.locator('#status').textContent(),/^Ready/);assert.equal(await page.locator('#style').inputValue(),'flag');await page.screenshot({path:out+'/flag.png',fullPage:true});
 await page.getByRole('button',{name:'Slot-together spike',exact:false}).click();await ready();assert.match(await page.locator('#status').textContent(),/^Ready/);assert(await page.locator('#download-fit').isEnabled());await page.screenshot({path:out+'/cross-flat.png',fullPage:true});
 await page.locator('#view-mode').selectOption('assembled');await page.screenshot({path:out+'/cross-assembled.png',fullPage:true});
 const wait=page.waitForEvent('download');await page.locator('#download-parts').click();const download=await wait;await download.saveAs(out+'/cross-print-kit.zip');const files=unzipSync(new Uint8Array(await readFile(out+'/cross-print-kit.zip'))),three=unzipSync(files['plant-tag.3mf']);assert(files['04_Cross_blade.stl']&&files['fit-test.stl']&&files['print-layout.stl']);const xml=strFromU8(three['3D/3dmodel.model']);assert.equal((xml.match(/<item /g)||[]).length,2);assert.equal((xml.match(/<component /g)||[]).length,4);assert.match(strFromU8(three['Metadata/model_settings.config']),/<object id="11">/);assert.match(strFromU8(files['READ ME.txt']),/sliding fit, not a locking clip/);
 await page.locator('#style').selectOption('tag');await page.locator('#build').click();await ready();assert(await page.locator('#assembly-guide').isHidden());assert(await page.locator('#view-mode').isDisabled());assert.equal(await page.locator('#view-mode').inputValue(),'print');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Slot-together spike',exact:false}).click();await ready();await page.screenshot({path:out+'/mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log(`PASS ${results.rows.length} geometric variants: closed oriented meshes, connected blades, swept assembly clearance, QR decoded from exported triangles in all rotations, 2-part 3MF, fit coupons, migration, mobile controls.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
