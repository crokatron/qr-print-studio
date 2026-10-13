import {zipSync,strToU8} from './vendor.js';
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function subtract(free,used){return free.flatMap(r=>{if(!overlap(r,used))return [r];const a=[];if(used.x>r.x)a.push({...r,w:used.x-r.x});if(used.x+used.w<r.x+r.w)a.push({...r,x:used.x+used.w,w:r.x+r.w-used.x-used.w});if(used.y>r.y)a.push({...r,h:used.y-r.y});if(used.y+used.h<r.y+r.h)a.push({...r,y:used.y+used.h,h:r.y+r.h-used.y-used.h});return a;}).filter((r,i,all)=>r.w>0&&r.h>0&&!all.some((s,j)=>i!==j&&r.x>=s.x&&r.y>=s.y&&r.x+r.w<=s.x+s.w&&r.y+r.h<=s.y+s.h&&(j<i||r.w<s.w||r.h<s.h)));}
export function packPlates(models){
 const plates=[],placements=[];
 for(const [index,m] of models.entries()){
  const w=m.layout.width,h=m.layout.length;let found;
  for(let plate=0;plate<=plates.length&&!found;plate++){
   const created=plate===plates.length;
   if(created){if(plate>=36)throw Error('This batch needs more than 36 plates. Select fewer tags.');plates.push(subtract([{x:8,y:32,w:240,h:216}],{x:204,y:204,w:44,h:44}));}
   const options=plates[plate].flatMap(r=>[false,true].map(rotate=>({x:r.x,y:r.y,w:rotate?h:w,h:rotate?w:h,rotate,plate,index})).filter(p=>p.w<=r.w&&p.h<=r.h));
   options.sort((a,b)=>a.y-b.y||a.x-b.x||a.h-b.h);
   if(options.length){found=options[0];plates[plate]=subtract(plates[plate],{...found,w:found.w+5,h:found.h+5});}
   else if(created)throw Error(`“${m.config.plantName||'Tag'}” does not fit the X1C plate with edge, cutter and purge-tower clearance. Reduce its dimensions.`);
  }
  placements.push(found);
 }
 const count=plates.length,cols=Math.ceil(Math.sqrt(count));
 return {count,placements:placements.map(p=>({...p,origin:[p.plate%cols*307.2,-Math.floor(p.plate/cols)*307.2]}))};
}
export function batch3MF(models){
 if(!models.length)throw Error('Select at least one plant.');
 const plan=packPlates(models),colors=[...new Set(models.flatMap(m=>m.bodies.map(b=>b.color.toUpperCase())))];
 let next=2;const resources=[],groups=[];
 for(const p of plan.placements){const m=models[p.index],min=m.layout.bounds.min,title=[m.config.genus,m.config.plantName].filter(Boolean).join(' ');
  for(const group of new Set(m.bodies.map(b=>b.group||'main'))){const parts=[];
   for(const b of m.bodies.filter(b=>(b.group||'main')===group)){const id=next++,slot=colors.indexOf(b.color.toUpperCase())+1;let mesh='<mesh><vertices>';
    for(let i=0;i<b.vertices.length;i+=3){const x=b.vertices[i]-min[0],y=b.vertices[i+1]-min[1];mesh+=`<vertex x="${p.origin[0]+p.x+(p.rotate?m.layout.length-y:x)}" y="${p.origin[1]+p.y+(p.rotate?x:y)}" z="${b.vertices[i+2]}"/>`;}
    mesh+='</vertices><triangles>';for(let i=0;i<b.indices.length;i+=3)mesh+=`<triangle v1="${b.indices[i]}" v2="${b.indices[i+1]}" v3="${b.indices[i+2]}"/>`;mesh+='</triangles></mesh>';
    resources.push(`<object id="${id}" name="${E(b.name)}" type="model" pid="1" pindex="${slot-1}">${mesh}</object>`);parts.push({id,slot,name:b.name});
   }
   const id=next++,name=title+(group==='blade'?' · Cross blade':'');groups.push({id,name,parts,plate:p.plate});resources.push(`<object id="${id}" name="${E(name)}" type="model"><components>${parts.map(b=>`<component objectid="${b.id}"/>`).join('')}</components></object>`);
  }
 }
 const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">BambuStudio-02.00.00.00</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="Designer">Mungoon QR Print Studio</metadata><metadata name="Title">Plant stakes · X1 Carbon plates</metadata><resources><basematerials id="1">${colors.map((c,i)=>`<base name="Filament ${i+1}" displaycolor="${c}FF"/>`).join('')}</basematerials>${resources.join('')}</resources><build>${groups.map(g=>`<item objectid="${g.id}" printable="1"/>`).join('')}</build></model>`;
 const settings=`<?xml version="1.0" encoding="UTF-8"?><config>${groups.map(g=>`<object id="${g.id}"><metadata key="name" value="${E(g.name)}"/><metadata key="extruder" value="1"/>${g.parts.map(b=>`<part id="${b.id}" subtype="normal_part"><metadata key="name" value="${E(b.name)}"/><metadata key="extruder" value="${b.slot}"/><metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/></part>`).join('')}</object>`).join('')}${Array.from({length:plan.count},(_,i)=>`<plate><metadata key="plater_id" value="${i+1}"/><metadata key="plater_name" value="Plant stakes ${i+1}"/>${groups.filter(g=>g.plate===i).map(g=>`<model_instance><metadata key="object_id" value="${g.id}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="${g.id}"/></model_instance>`).join('')}</plate>`).join('')}</config>`;
 const files={'[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/plain"/></Types>'),'_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),'3D/3dmodel.model':strToU8(model),'Metadata/model_settings.config':strToU8(settings),'Metadata/project_settings.config':strToU8(JSON.stringify({filament_colour:colors,filament_type:colors.map(()=>'PLA'),filament_settings_id:colors.map(()=>'Generic PLA'),filament_diameter:colors.map(()=>'1.75'),printer_model:'Bambu Lab X1 Carbon',nozzle_diameter:[String(models[0].config.nozzle)],printable_area:['0x0','256x0','256x256','0x256'],printable_height:'256'})),'Metadata/plant-plates.json':strToU8(JSON.stringify(plan))};
 return {data:zipSync(files,{level:6}),plan};
}
