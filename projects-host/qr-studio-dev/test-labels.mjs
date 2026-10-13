import fs from 'node:fs/promises';

import assert from 'node:assert/strict';

const original=globalThis.fetch;

globalThis.fetch=async(url,...args)=>String(url).startsWith('file:')?new Response(await fs.readFile(new URL(url))):original(url,...args);

const {buildLabel,validateLabel,labelsPDF,labelsXLSX}=await import('../site/qr-studio/labels.js');

const {unzipSync}=await import('../site/qr-studio/vendor.js');

const plant={id:36,name:'Amazonian alocasia (Polly type)',scientific_name:'Alocasia × amazonica',qr_url:'https://example.invalid/P/36'};

const models=[];

for(const config of [{},{width:40,height:12,padding:.5},{dpi:300},{printer:'custom',width:62,height:40,padding:2,scientific:true}]){

 const m=await buildLabel(plant,config);assert.equal(m.lines.join(' '),plant.name+(config.scientific?' '+plant.scientific_name:''));

 const {width,height,padding,dpi}=m.config,dot=25.4/dpi;

 for(const [x,y] of m.polygons.flat())assert(x>=padding&&x<=width-padding&&y>=padding&&y<=height-padding);

 for(const [x,y,w,h] of m.rects)assert(x>=padding&&y>=padding&&x+w<=width-padding&&y+h<=height-padding);

 assert.equal(m.rects.length,0,'Name labels must not contain a QR');models.push(m);

}

for(const c of [{padding:8},{height:40},{dpi:600},{width:NaN}])assert.throws(()=>validateLabel(c));

await assert.rejects(()=>buildLabel(plant,{width:15,height:10,padding:3,fontSize:8}));

const pdf=new TextDecoder().decode(labelsPDF(models));assert(pdf.includes('/Count 4'));assert.equal((pdf.match(/\/MediaBox/g)||[]).length,4);const start=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(start,start+4),'xref');

const strFromU8=b=>new TextDecoder().decode(b);

const excel=unzipSync(labelsXLSX([plant,{...plant,id:37,name:'Other plant'}]));assert(strFromU8(excel['xl/worksheets/sheet1.xml']).includes('A1:A3'));assert(strFromU8(excel['xl/sharedStrings.xml']).includes(plant.name));

console.log('PASS: D11 original/upgraded, compact and custom labels, full botanical text, padding bounds, no QR on labels, Excel batch records, size rejection and multi-page PDF.');

