import { build } from 'esbuild';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const out=resolve(import.meta.dirname,'../site/qr-studio');
await build({entryPoints:[resolve(import.meta.dirname,'vendor-entry.js')],bundle:true,format:'esm',platform:'browser',external:['node:*'],target:'es2022',minify:true,outfile:out+'/vendor.js'});
await copyFile(require.resolve('manifold-3d/manifold.wasm'),out+'/manifold.wasm');
const pdf=dirname(require.resolve('pdfjs-dist/package.json'));
await copyFile(pdf+'/build/pdf.min.mjs',out+'/pdf.js');
await copyFile(pdf+'/build/pdf.worker.min.mjs',out+'/pdf.worker.js');
const three=resolve(dirname(require.resolve('three')),'..');
await copyFile(resolve(import.meta.dirname,'font.json'),out+'/font.json');
let licenses='QR Print Studio bundled libraries\n\n';
for(const pkg of ['three','manifold-3d','qrcode','jsqr','fflate','pdfjs-dist']){
 let dir=dirname(require.resolve(pkg==='manifold-3d'?'manifold-3d/manifold.js':pkg));
 while(true){try {if(JSON.parse(await readFile(dir+'/package.json','utf8')).name===pkg)break;}catch{}dir=dirname(dir);}
 for(const file of ['LICENSE','LICENSE.md','LICENSE.txt'])try {licenses+='\n'+pkg+'\n'+await readFile(dir+'/'+file,'utf8')+'\n';break;}catch{}
}
licenses+='\nHelvetiker font (Three.js r180)\n'+await readFile(resolve(import.meta.dirname,'font-license.txt'),'utf8');
await writeFile(out+'/licenses.txt',licenses);
console.log('Built local QR Studio dependencies in',out);
