import {FontLoader,zipSync,strToU8} from './vendor.js';

export const labelDefaults={width:50,height:15,padding:1,fontSize:3,dpi:203,printer:'d11',scientific:false};

let fontPromise;

export function validateLabel(input={}){

 const c={...labelDefaults,...input};

 for(const [k,min,max] of [['width',15,150],['height',10,150],['padding',0,20],['fontSize',1.8,8],['dpi',203,600]]){c[k]=Number(c[k]);if(!Number.isFinite(c[k])||c[k]<min||c[k]>max)throw Error(`${k}: enter ${min}–${max}.`);}

 if(!['d11','custom'].includes(c.printer)||![203,300,600].includes(c.dpi))throw Error('Choose a valid printer and resolution.');

 if(c.printer==='d11'&&(c.height>15||c.dpi===600))throw Error('D11: use a 10–15 mm label height and 203 dpi (original) or 300 dpi (upgraded).');

 if(c.padding*2>=Math.min(c.width,c.height))throw Error('Padding leaves no space for the label.');

 return c;

}

export async function buildLabel(plant,input={}){

 const c=validateLabel(input),dot=25.4/c.dpi;

 if(!fontPromise)fontPromise=fetch(new URL('./font.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Could not load label font.');return r.json();}).then(f=>new FontLoader().parse(f));

 const font=await fontPromise;

 const pxWidth=Math.round(c.width/dot),pxHeight=Math.round(c.height/dot),pad=Math.ceil(c.padding/dot);

 const inkTop=c.printer==='d11'?Math.max(pad,Math.ceil((pxHeight-12/dot)/2)):pad,inkBottom=pxHeight-inkTop;

 const rects=[],x=pad*dot,y=inkTop*dot;

 const available=(pxWidth-pad)*dot-x,bottom=inkBottom*dot,polygons=[],lines=[];

 function shape(text){

  for(const char of text)if(!font.data.glyphs[char])throw Error(`Label font does not support “${char}”.`);

  const contours=[];for(const s of font.generateShapes(text,c.fontSize)){contours.push(s.getPoints(8));for(const h of s.holes)contours.push(h.getPoints(8));}

  const pts=contours.flat();return {contours,minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};

 }

 const names=[String(plant.name||'').split(' · ')[0],...(c.scientific&&plant.scientific_name?[plant.scientific_name]:[])];

 for(const name of names){let line='';for(const word of name.split(/\s+/).filter(Boolean)){const trial=line?line+' '+word:word,s=shape(trial);if(s.maxX-s.minX<=available){line=trial;continue;}if(line){lines.push(line);line='';}const w=shape(word);if(w.maxX-w.minX>available)throw Error('Name is too wide. Increase label length or choose a smaller letter size.');line=word;}if(line)lines.push(line);}

 const shapes=lines.map(shape),heights=shapes.map(s=>s.maxY-s.minY),lineGap=.5,block=heights.reduce((a,b)=>a+b,0)+Math.max(0,lines.length-1)*lineGap;

 if(block>bottom-y)throw Error('Name does not fit at this letter size. Increase the label size, reduce padding, or omit the scientific name.');

 let top=y+(bottom-y-block)/2;

 shapes.forEach((s,i)=>{for(const contour of s.contours)polygons.push(contour.map(p=>[x+(available-(s.maxX-s.minX))/2+p.x-s.minX,top+s.maxY-p.y]));top+=heights[i]+lineGap;});

 return {config:c,plant,rects,polygons,lines,pxWidth,pxHeight,warnings:[]};

}

export function drawLabel(canvas,m,preview=false){

 const {width,height}=m.config;canvas.width=m.pxWidth;canvas.height=m.pxHeight;

 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(m.config.dpi/25.4,m.config.dpi/25.4);ctx.fillStyle='#000';

 for(const r of m.rects)ctx.fillRect(...r);ctx.beginPath();for(const p of m.polygons){p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}ctx.fill('evenodd');

 // Thermal export is strictly black and white; no grey antialiasing or JPEG artefacts.

 ctx.resetTransform();const image=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<image.data.length;i+=4){const v=image.data[i]<128?0:255;image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;}ctx.putImageData(image,0,0);

 if(preview){canvas.style.aspectRatio=width+'/'+height;canvas.style.height='auto';}

}

export function labelsPDF(models){

 if(!models.length)throw Error('Select at least one plant.');

 const objs=['',''],pages=[],n=v=>Number(v.toFixed(5)).toString(),pt=72/25.4;

 for(const m of models){const {width:w,height:h}=m.config;let stream='0 g\n';for(const [x,y,rw,rh] of m.rects)stream+=`${n(x*pt)} ${n((h-y-rh)*pt)} ${n(rw*pt)} ${n(rh*pt)} re f\n`;

  for(const poly of m.polygons){poly.forEach(([x,y],i)=>{stream+=`${n(x*pt)} ${n((h-y)*pt)} ${i?'l':'m'}\n`;});stream+='h\n';}stream+='f*\n';

  const page=objs.length+1,content=page+1;pages.push(page);objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(w*pt)} ${n(h*pt)}] /Resources << >> /Contents ${content} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);

 }

 objs[0]='<< /Type /Catalog /Pages 2 0 R >>';objs[1]=`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(i=>i+' 0 R').join(' ')}] >>`;

 let pdf='%PDF-1.4\n',offsets=[0];objs.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const start=pdf.length;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(i=>String(i).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return strToU8(pdf);

}

export function labelsXLSX(plants){

 if(!plants.length)throw Error('Select at least one plant.');

 const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

 const strings=['Plant name',...plants.map(p=>String(p.name).split(' · ')[0])];

 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';

 const files={

 '[Content_Types].xml':xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',

 '_rels/.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',

 'xl/workbook.xml':xml+`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Plant names" sheetId="1" r:id="rId1"/></sheets></workbook>`,

 'xl/_rels/workbook.xml.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',

 'xl/sharedStrings.xml':xml+`<sst xmlns="${ns}" count="${strings.length}" uniqueCount="${strings.length}">${strings.map(t=>'<si><t xml:space="preserve">'+E(t)+'</t></si>').join('')}</sst>`,

 'xl/worksheets/sheet1.xml':xml+`<worksheet xmlns="${ns}"><dimension ref="A1:A${strings.length}"/><sheetData>${strings.map((_,i)=>`<row r="${i+1}"><c r="A${i+1}" t="s"><v>${i}</v></c></row>`).join('')}</sheetData></worksheet>`

 };return zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));

}

