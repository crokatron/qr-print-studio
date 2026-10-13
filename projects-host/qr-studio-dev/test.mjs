import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
const root=resolve(import.meta.dirname,'../site'),out=resolve(import.meta.dirname,'../../outputs/qr-studio');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),name=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname,file=resolve(root,'.'+name);if(!file.startsWith(root))throw Error();const raw=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(raw);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/qr-studio/`);
 await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Ready')||document.getElementById('status').classList.contains('error'),{},{timeout:60000});
 console.log('Initial:',await page.locator('#status').textContent());
 assert.match(await page.locator('#status').textContent(),/^Ready/);
 await page.screenshot({path:out+'/desktop.png',fullPage:true});
 const checks=await page.evaluate(async()=>{
  const {buildModel,defaults}=await import('./geometry.js'),{jsQR}=await import('./vendor.js');
  const cases=[{...defaults},{...defaults,style:'tag',genus:'',plantName:''},{...defaults,genus:'Monstera',plantName:'Borsigiana albo',ecc:'H',textColor:'#164322'},{...defaults,width:30,content:'https://example.invalid/plant/123456789012345678901234567890'}];
  const results=[];
  function checkMesh(mesh){const edges=new Map();let volume=0;const v=mesh.vertices,t=mesh.indices;for(let i=0;i<t.length;i+=3){const p=t.slice(i,i+3);for(let j=0;j<3;j++){const a=p[j],b=p[(j+1)%3],key=a<b?a+','+b:b+','+a;const row=edges.get(key)||[0,0];row[0]++;row[1]+=a<b?1:-1;edges.set(key,row);}const a=v.slice(p[0]*3,p[0]*3+3),b=v.slice(p[1]*3,p[1]*3+3),c=v.slice(p[2]*3,p[2]*3+3);volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
   return {closed:[...edges.values()].every(([count,dir])=>count===2&&dir===0),volume,expected:mesh.volume,triangles:t.length/3};}
  for(const c of cases){const m=await buildModel(c),checks=[...m.bodies,m.combined].map(checkMesh),sum=m.bodies.reduce((s,b)=>s+b.volume,0);results.push({checks,unionVolume:m.combined.volume,sum,warnings:m.warnings,parts:m.bodies.length,layout:m.layout});}
  const canvas=document.getElementById('qr-canvas'),ctx=canvas.getContext('2d'),image=ctx.getImageData(0,0,canvas.width,canvas.height),decoded=jsQR(image.data,image.width,image.height);return {results,decoded:decoded?.data};
 });
 assert.equal(checks.decoded,'https://example.invalid/');
 for(const result of checks.results){for(const mesh of result.checks){assert(mesh.closed,'Every indexed edge must have two oppositely directed faces');assert(mesh.volume>0);assert(Math.abs(mesh.volume-mesh.expected)<.02);}assert(Math.abs(result.sum-result.unionVolume)<.001,'Bodies must not overlap in volume');}
 assert.equal(checks.results[1].parts,2);assert(checks.results[3].warnings.some(w=>w.includes('QR square')));
 console.log('Mesh checks:',JSON.stringify(checks.results.map(r=>({parts:r.parts,triangles:r.checks.map(m=>m.triangles),warnings:r.warnings}))));
 // Private PDF fixture is not part of the community test suite.
 await page.locator('#genus').fill('');await page.locator('#plantName').fill('TEST');await page.locator('#build').click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Ready'),{},{timeout:45000});
 const dl=page.waitForEvent('download');await page.locator('#download-parts').click();const kit=await dl;await kit.saveAs(out+'/TEST-print-kit.zip');
 const files=unzipSync(new Uint8Array(await readFile(out+'/TEST-print-kit.zip')));assert(files['03_Plant_lettering.stl']);
 const parts=unzipSync(files['plant-tag.3mf']);assert.match(strFromU8(parts['Metadata/model_settings.config']),/key="extruder" value="2"/);assert.equal((strFromU8(parts['3D/3dmodel.model']).match(/<component /g)||[]).length,3);
 await writeFile(out+'/TEST.3mf',files['plant-tag.3mf']);await writeFile(out+'/TEST-combined.stl',files['combined.stl']);
 await page.locator('#width').fill('70');assert(await page.locator('#download-3mf').isDisabled());await page.locator('#build').click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Ready'),{},{timeout:45000});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#qr-file').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert(await page.locator('#download-3mf').isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS: QR scan round trip, closed oriented meshes, non-overlapping parts, 3MF/STL downloads, stale export guard, invalid import and mobile fit.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
