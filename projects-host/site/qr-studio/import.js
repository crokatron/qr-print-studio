import { jsQR } from './vendor.js';
export async function decodeFile(file,pageNumber=1){
 if(!file||file.size>10*1024*1024)throw Error('Choose a QR image or PDF smaller than 10 MB.');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});let note='';
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
  const pdfjs=await import('./pdf.js');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.js',import.meta.url).href;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  task.onPassword=()=>task.destroy();
  let pdf;
  try{pdf=await task.promise;if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>pdf.numPages)throw Error(`Choose a PDF page from 1 to ${pdf.numPages}.`);const page=await pdf.getPage(pageNumber),size=page.getViewport({scale:1}),viewport=page.getViewport({scale:2400/Math.max(size.width,size.height)});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,canvasContext:ctx,viewport}).promise;note=`PDF page ${pageNumber} of ${pdf.numPages}.`;}finally{await task.destroy();}
 }else{
  if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Use a PNG, JPG, WebP image or a PDF.');
  const bitmap=await createImageBitmap(file);
  try{const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);}finally{bitmap.close();}
 }
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),result=jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});
 if(!result?.data)throw Error('No readable QR code found. Try a sharper image, crop to one code, or select another PDF page.');
 return {content:result.data,note:note+' QR content read successfully. Check the destination below; a clean dark-on-light code will be generated.'};
}
