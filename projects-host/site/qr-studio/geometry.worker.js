import { buildModel } from './geometry.js';
self.onmessage=async({data})=>{try{const model=await buildModel(data.config);const buffers=[...model.bodies,model.combined,...(model.fitTest?[model.fitTest]:[])].flatMap(x=>[x.vertices.buffer,x.indices.buffer]);self.postMessage({id:data.id,model},buffers);}catch(e){self.postMessage({id:data.id,error:e.message||'The model could not be built.'});}};
