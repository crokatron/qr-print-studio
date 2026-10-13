import { QRCode, ManifoldModule, FontLoader } from './vendor.js';



export const defaults={content:'https://example.invalid/',genus:'Alocasia',plantName:'Polly',style:'flag',width:60,base:2.4,relief:0.6,stakeLength:80,stakeWidth:15,stakeThickness:2.4,construction:'flat',reinforcement:'rounded',clearance:0.25,flagSide:'left',flagShape:'rectangle',informationLayout:'stacked',rotation:0,fontSize:8,textMode:'label',labelWidth:50,labelHeight:15,nozzle:0.4,ecc:'M',backColor:'#f5f1de',qrColor:'#151b19',textColor:'#151b19'};
let runtime;

async function dependencies(){

 if(!runtime)runtime=Promise.all([ManifoldModule({locateFile:()=>new URL('./manifold.wasm',import.meta.url).href}),fetch(new URL('./font.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Could not load lettering font.');return r.json();})]).then(([m,f])=>{m.setup();return {m,font:new FontLoader().parse(f)};});

 return runtime;

}

export function validate(input){

 const c={...defaults,...input};

 // Older saved designs retain their original blade thickness and straight neck.

 if(input.stakeThickness===undefined)c.stakeThickness=Number(c.base);

 if(input.reinforcement===undefined)c.reinforcement='straight';

 if(typeof c.content!=='string'||!c.content.trim())throw Error('Enter the QR destination or import a QR code.');

 if(new TextEncoder().encode(c.content).length>800)throw Error('Use a shorter destination (up to 800 UTF-8 bytes) for a printable QR code.');

 for(const key of ['genus','plantName']){if(typeof c[key]!=='string'||c[key].length>120)throw Error('Keep each plant label to 120 characters or fewer.');c[key]=c[key].trim();}

 for(const [key,lo,hi] of [['width',30,150],['base',1.2,6],['relief',0.4,1.2],['stakeLength',30,180],['stakeWidth',8,30],['stakeThickness',1.2,8],['clearance',0.1,0.8],['fontSize',3,24],['nozzle',0.2,1],['labelWidth',15,140],['labelHeight',10,100]]){

  c[key]=Number(c[key]);if(!Number.isFinite(c[key])||c[key]<lo||c[key]>hi)throw Error(`${key}: enter a value between ${lo} and ${hi} mm.`);

 }

 if(!['raised','label','none'].includes(c.textMode))throw Error('Choose raised names, a sticker area or QR only.');

 c.rotation=Number(c.rotation);

 if(!['stake','flag','tag'].includes(c.style)||!['L','M','Q','H'].includes(c.ecc)||!['stacked','side'].includes(c.informationLayout)||![0,90,180,270].includes(c.rotation))throw Error('Choose a valid backing, information layout, rotation and QR correction level.');

 if(!['flat','cross'].includes(c.construction)||!['straight','flared','rounded'].includes(c.reinforcement)||!['left','right'].includes(c.flagSide))throw Error('Choose valid spike options.');

 if(!['pointed','rectangle','triangle','circle'].includes(c.flagShape))throw Error('Choose a valid flag outline.');

 if(c.style!=='tag'&&c.construction==='cross'&&(c.stakeWidth-c.stakeThickness-c.clearance)/2<Math.max(1.6,3*c.nozzle))throw Error('The slot leaves too little material beside it. Increase spike width or reduce spike thickness.');

 for(const k of ['backColor','qrColor','textColor'])if(!/^#[a-f\d]{6}$/i.test(c[k]))throw Error('Choose valid solid colours.');

 return c;

}

export function makeQR(content,ecc='M'){

 const qr=QRCode.create(content,{errorCorrectionLevel:ecc});

 return {size:qr.modules.size,data:Array.from(qr.modules.data),version:qr.version};

}

export function luminance(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}

function meshData(solid){

 if(solid.status()!=='NoError'||solid.isEmpty())throw Error('Unable to create a closed printable body. Try simpler labels or larger dimensions.');

 const raw=solid.getMesh(),map=new Map(),verts=[],indices=[],merges=new Map();

 for(let i=0;i<(raw.mergeFromVert?.length||0);i++)merges.set(raw.mergeFromVert[i],raw.mergeToVert[i]);

 for(const vi of raw.triVerts){let v=vi;while(merges.has(v))v=merges.get(v);if(!map.has(v)){map.set(v,verts.length/3);verts.push(...raw.vertProperties.slice(v*raw.numProp,v*raw.numProp+3));}indices.push(map.get(v));}

 return {vertices:new Float32Array(verts),indices:new Uint32Array(indices),volume:solid.volume()};

}

export async function buildModel(input){

 const c=validate(input),qr=makeQR(c.content,c.ecc),{m,font}=await dependencies(),owned=[];

 const keep=x=>(owned.push(x),x),rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];

 try{

  const requestedWidth=c.width,minimumWidth=6+(qr.size+8)*2*c.nozzle;

  if(minimumWidth>150)throw Error('This link is too dense for the selected nozzle. Shorten the link or choose a smaller nozzle.');

  c.width=Math.max(c.width,Math.ceil(minimumWidth*10)/10);

  const hasStake=c.style!=='tag',cross=hasStake&&c.construction==='cross';

  const requestedFontSize=c.fontSize;c.fontSize=Math.max(c.fontSize,6,c.nozzle*20);

  const textCache=new Map();

  function textShape(value){

   if(textCache.has(value))return textCache.get(value);

   for(const char of value)if(!font.data.glyphs[char])throw Error(`The lettering font does not support “${char}”. Use Latin letters, numbers or supported punctuation.`);

   const contours=[];for(const shape of font.generateShapes(value,c.fontSize)){contours.push(shape.getPoints(8).map(p=>[p.x,p.y]));for(const hole of shape.holes)contours.push(hole.getPoints(8).map(p=>[p.x,p.y]));}

   const points=contours.flat();let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [x,y] of points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}

   const valueShape={contours,minX,maxX,minY,maxY,width:points.length?maxX-minX:0,height:points.length?maxY-minY:0};textCache.set(value,valueShape);return valueShape;

  }

  const sourceLabels=(c.textMode==='raised'?[['Genus',c.genus],['Plant name',c.plantName]]:[]).filter(([,value])=>value),side=c.informationLayout==='side';

  // Never shrink lettering to fit. Widen for single words and wrap full names onto more lines.

  const longestWord=Math.max(0,...sourceLabels.flatMap(([,value])=>value.split(/\s+/).map(word=>textShape(word).width)));

  let labelWidth=side&&sourceLabels.length?Math.max(50,c.width*.75,Math.min(142,longestWord)+8):0;

  if(!side&&sourceLabels.length)c.width=Math.max(c.width,Math.min(150,Math.ceil((longestWord+8)*10)/10));

  const available=(side?labelWidth:c.width)-8,lines=[];

  for(const [kind,value] of sourceLabels){let line='';for(const word of value.split(/\s+/)){

    const candidate=line?line+' '+word:word;if(textShape(candidate).width<=available){line=candidate;continue;}

    if(line){lines.push({kind,text:line,...textShape(line)});line='';}

    // Only unusually long unbroken words need a character break.

    for(const char of word){if(line&&textShape(line+char).width>available){lines.push({kind,text:line,...textShape(line)});line='';}line+=char;}

   }if(line)lines.push({kind,text:line,...textShape(line)});

  }

  if(c.textMode==='label')c.width=Math.max(c.width,c.labelWidth+4);

  const lineGap=Math.max(1.5,c.nozzle*3),labelHeight=c.textMode==='label'?c.labelHeight+4:lines.length?lines.reduce((n,line)=>n+line.height,0)+(lines.length-1)*lineGap+6:0;

  if(c.textMode==='label'&&side)labelWidth=c.labelWidth+4;

  const module=(c.width-6)/(qr.size+8),faceW=c.width+labelWidth,faceH=side?Math.max(c.width,labelHeight):c.width+labelHeight,turned=c.rotation%180!==0;

  const artW=turned?faceH:faceW,artH=turned?faceW:faceH,flag=c.style==='flag',shaped=flag&&['triangle','circle'].includes(c.flagShape);

  let plateW=artW,plateH=artH,offsetX=0,offsetY=0,outline,lowerEdge=()=>0;

  if(flag&&c.flagShape==='triangle'){

   // A full triangle encloses the unchanged information rectangle. Its vertical base stays beside the pole.

   plateW=2*(artW+2);plateH=2*(artH+2);offsetX=c.flagSide==='left'?1:plateW-artW-1;offsetY=(plateH-artH)/2;

   outline=[c.flagSide==='left'?[[0,0],[plateW,plateH/2],[0,plateH]]:[[0,plateH/2],[plateW,0],[plateW,plateH]]];

   lowerEdge=x=>(c.flagSide==='left'?x:plateW-x)*plateH/(2*plateW);

  }else if(flag&&c.flagShape==='circle'){

   const radius=Math.hypot(artW,artH)/2+1;plateW=plateH=2*radius;offsetX=radius-artW/2;offsetY=radius-artH/2;

   outline=[Array.from({length:128},(_,i)=>{const a=i*Math.PI/64;return [radius+radius*Math.cos(a),radius+radius*Math.sin(a)];})];

   lowerEdge=x=>radius-Math.sqrt(Math.max(0,radius*radius-(x-radius)**2));

  }else if(flag&&c.flagShape==='rectangle'){

   const r=3;outline=[[[plateW-r,r,-Math.PI/2],[plateW-r,plateH-r,0],[r,plateH-r,Math.PI/2],[r,r,Math.PI]].flatMap(([x,y,a])=>Array.from({length:9},(_,i)=>[x+r*Math.cos(a+i*Math.PI/16),y+r*Math.sin(a+i*Math.PI/16)]))];

  }else outline=[rect(0,0,plateW,plateH)];

  const flagDepth=flag&&c.flagShape==='pointed'?Math.min(14,plateW*.18):0;

  if(flagDepth)outline.push(c.flagSide==='left'?[[plateW-1,0],[plateW+flagDepth,plateH/2],[plateW-1,plateH]]:[[-flagDepth,plateH/2],[1,0],[1,plateH]]);

  // Only the information rotates: directional flag outlines continue to point away from the pole.

  const point=([x,y])=>{const p=c.rotation===90?[y,faceW-x]:c.rotation===180?[faceW-x,faceH-y]:c.rotation===270?[faceH-y,x]:[x,y];return [p[0]+offsetX,p[1]+offsetY];};

  const section=polys=>keep(new m.CrossSection(polys,'Positive'));

  const placedSection=polys=>section(polys.map(p=>p.map(point)));

  const extrude=(cs,h,z=0)=>{const low=keep(cs.extrude(h));return z?keep(low.translate([0,0,z])):low;};

  const qx=3+4*module,qy=faceH-3-4*module;

  const flushFlag=flag&&c.flagShape==='rectangle';

  const poleInset=flag&&c.flagShape==='circle'?Math.max(plateW*.275,c.stakeWidth/2+2):c.stakeWidth/2+(flushFlag?0:2);

  const pole=flag?(c.flagSide==='left'?poleInset:plateW-poleInset):plateW/2;

  const neck=c.reinforcement!=='straight'?Math.min(10,c.stakeLength*.12):4,tip=Math.min(c.stakeLength*.2,c.stakeWidth*.8);

  const head=section(outline);

  let base=extrude(head,c.base),assembly=null,blade=null,fitTest=null;

  const slotWidth=c.stakeThickness+c.clearance;

  function openSlot(x,open,end,width){

   const low=Math.min(open,end),high=Math.max(open,end),stem=section([rect(x-width/2,low,width,high-low)]);

   const circle=keep(m.CrossSection.circle(width/2,24)),cap=keep(circle.translate([x,end]));

   return keep(m.CrossSection.union([stem,cap]));

  }

  if(hasStake){

   const half=c.stakeWidth/2,flare=c.reinforcement!=='straight'?Math.min(8,c.stakeWidth*.5):0;

   const rootLeft=Math.max(flushFlag?0:.8,pole-half-flare),rootRight=Math.min(plateW-(flushFlag?0:.8),pole+half+flare);

   const rootY=shaped?Math.max(lowerEdge(rootLeft),lowerEdge(rootRight))+1:flushFlag?3:.5;

   let profile=[[rootLeft,rootY],[pole-half,-neck],[pole-half,-c.stakeLength+tip],[pole,-c.stakeLength],[pole+half,-c.stakeLength+tip],[pole+half,-neck],[rootRight,rootY]];

   if(flushFlag&&c.reinforcement==='rounded'){

    const radius=Math.min(8,c.stakeWidth*.5,c.stakeLength*.15,plateW-c.stakeWidth-3);

    const edge=c.stakeWidth;

    profile=[[0,3],[0,-c.stakeLength+tip],[half,-c.stakeLength],[edge,-c.stakeLength+tip],[edge,-radius],

     ...Array.from({length:17},(_,i)=>{const a=Math.PI-i*Math.PI/32;return [edge+radius+radius*Math.cos(a),-radius+radius*Math.sin(a)];}),[edge+radius,3]];

    if(c.flagSide==='right')profile=profile.map(([x,y])=>[plateW-x,y]).reverse();

   }

   let stem=section([profile]);

   if(cross){

    const joint=-(c.stakeLength+neck)/2;

    stem=keep(stem.subtract(openSlot(pole,-c.stakeLength-1,joint+c.clearance/2,slotWidth)));

    const mainMax=plateW+(c.style==='flag'&&c.flagSide==='left'?flagDepth:0),printX=mainMax+10+half;

    const second=section([[[printX-half,-neck],[printX-half,-c.stakeLength+tip],[printX,-c.stakeLength],[printX+half,-c.stakeLength+tip],[printX+half,-neck]]]);

    blade=extrude(keep(second.subtract(openSlot(printX,-neck+1,joint-c.clearance/2,slotWidth))),c.stakeThickness);

    assembly={pole,printX,neck,joint,slotWidth,clearance:c.clearance,sideWall:(c.stakeWidth-slotWidth)/2,

     matrix:[0,0,-1,0,0,1,0,0,1,0,0,0,pole-c.stakeThickness/2,0,printX+c.stakeThickness/2,1]};

    const cw=Math.max(14,slotWidth+6),ch=26;

    const a=keep(section([rect(0,0,cw,ch)]).subtract(openSlot(cw/2,-1,ch/2+c.clearance/2,slotWidth)));

    const b=keep(section([rect(cw+6,0,cw,ch)]).subtract(openSlot(cw*1.5+6,ch+1,ch/2-c.clearance/2,slotWidth)));

    fitTest=meshData(extrude(keep(m.CrossSection.union([a,b])),c.stakeThickness));

   }

   let stemSolid=extrude(stem,c.stakeThickness);

   // The attachment may enter a curved/sloping head; keep its face flat underneath QR and lettering.

   if(shaped&&c.stakeThickness>c.base)stemSolid=keep(stemSolid.subtract(extrude(head,c.stakeThickness-c.base,c.base)));

   base=keep(m.Manifold.union([base,stemSolid]));

  }

  const cells=[];

  for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;){if(!qr.data[y*qr.size+x]){x++;continue;}let end=x+1;while(end<qr.size&&qr.data[y*qr.size+end])end++;cells.push(rect(qx+x*module,qy-(y+1)*module,(end-x)*module,module));x=end;}

  const qrSection=placedSection(cells),qrSolid=extrude(qrSection,c.relief,c.base);

  // A tiny embedded overlap makes the single-colour union robust at coincident faces.

  // Separate colour bodies still meet exactly at backing height without volume overlap.

  const joined=[base,extrude(qrSection,c.relief+.01,c.base-.01)];

  const warnings=[],labelPolys=[],labels=[];

  if(c.width>requestedWidth)warnings.push(`Panel widened to ${c.width.toFixed(1)} mm to fit printable QR squares and unshrunk lettering.`);

  if(c.fontSize>requestedFontSize)warnings.push(`Letter size increased to ${c.fontSize.toFixed(1)} mm for the ${c.nozzle} mm nozzle. Names wrap instead of shrinking.`);

  let textTop=(side?(faceH+labelHeight)/2:labelHeight)-3;

  for(const line of lines){

   const {kind,text,contours,minX,minY,width,height}=line;if(!contours.length)continue;

   const y=textTop-height,x=(side?c.width:0)+((side?labelWidth:c.width)-width)/2;

   const cs=keep(new m.CrossSection(contours,'EvenOdd')),moved=keep(cs.translate([x-minX,y-minY]));

   labelPolys.push(placedSection(moved.toPolygons()));labels.push({kind,text,x,y,height,fontSize:c.fontSize});textTop=y-lineGap;

  }

  const bodies=[{name:hasStake?'01 Backing and stake':'01 Backing',group:'main',color:c.backColor,solid:base},{name:'02 QR code',group:'main',color:c.qrColor,solid:qrSolid}];

  if(labelPolys.length){const cs=keep(m.CrossSection.union(labelPolys)),solid=extrude(cs,c.relief,c.base);bodies.push({name:'03 Plant lettering',group:'main',color:c.textColor,solid});joined.push(extrude(cs,c.relief+.01,c.base-.01));}

  if(blade){

   const rotated=keep(blade.rotate([0,90,0])),assembled=keep(rotated.translate([pole-c.stakeThickness/2,0,assembly.printX+c.stakeThickness/2]));

   const interference=keep(m.Manifold.intersection([base,assembled]));assembly.intersectionVolume=interference.isEmpty()?0:interference.volume();

   if(assembly.intersectionVolume>.00001)throw Error('The two spike blades would collide. Change the dimensions and rebuild.');

   bodies.push({name:'04 Cross blade',group:'blade',assemblyMatrix:assembly.matrix,color:c.backColor,solid:blade});

   joined.push(blade);

   warnings.push(`Print the two blades flat, then slide them together at 90°. Slot ${slotWidth.toFixed(2)} mm for a ${c.stakeThickness.toFixed(2)} mm blade (${c.clearance.toFixed(2)} mm total clearance). Print the fit test first; the joint is a sliding fit, not a locking clip.`);

  }

  const combined=keep(m.Manifold.union(joined));

  if(module+1e-8<2*c.nozzle)warnings.push(`Each QR square is ${module.toFixed(2)} mm wide. Aim for at least ${(2*c.nozzle).toFixed(2)} mm with your nozzle; increase the tag width or shorten the QR content.`);

  const contrast=(luminance(c.backColor)+.05)/(luminance(c.qrColor)+.05);

  if(contrast<4.5)warnings.push('Use a pale, opaque backing and a much darker QR colour. These colours may be difficult to scan.');

  if(hasStake&&c.stakeWidth>plateW-8)warnings.push('The spike is nearly as wide as the plaque. A narrower spike is easier to insert into a pot.');

  if(hasStake&&c.stakeLength/c.stakeThickness>35)warnings.push('This is a long, thin spike. Consider more thickness or a shorter length to reduce bending.');

  if(hasStake&&c.stakeThickness<2)warnings.push('The spike is under 2 mm thick. Choose a thicker spike for repeated insertion.');

  if(c.style==='flag')warnings.push('The flag projects sideways from its spike. Use a rounded or flared neck and avoid pushing the tag from its far end.');

  const bounds=combined.boundingBox();

  return {config:c,qr,layout:{width:bounds.max[0]-bounds.min[0],height:plateH,length:bounds.max[1]-bounds.min[1],thickness:bounds.max[2],bounds,plateW,plateH,module,qx,qy,labelHeight,labels,artW,artH,offsetX,offsetY,outline,pole},assembly,fitTest,warnings,bodies:bodies.map(({solid,...b})=>({...b,...meshData(solid)})),combined:meshData(combined)};

 }finally{for(const obj of owned.reverse())obj.delete();}

}

