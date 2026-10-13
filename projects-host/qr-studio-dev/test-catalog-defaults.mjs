import assert from 'node:assert/strict';

import {initialDraft,defaultFlag,DRAFT_KEY,linkedConfig} from '../site/qr-studio/catalog.js';

import {defaults} from '../site/qr-studio/geometry.js';

const legacy={...defaults,style:'stake',informationLayout:'side',content:'https://example.org/previous',plantName:'Keep me'};

const items=new Map([['mungoon-qr-print-v1',JSON.stringify(legacy)]]),storage={getItem:key=>items.get(key)};

const first=initialDraft(storage);assert.equal(first.config.style,'flag');assert.equal(first.config.informationLayout,'stacked');assert.equal(first.legacy.content,legacy.content);assert.equal(items.size,1);

items.set(DRAFT_KEY,JSON.stringify({...defaults,style:'tag'}));assert.equal(initialDraft(storage).config.style,'tag');

const reset=defaultFlag({...legacy,nozzle:.8,backColor:'#ffffff'});assert.equal(reset.style,'flag');assert.equal(reset.flagSide,'left');assert.equal(reset.flagShape,'rectangle');assert.equal(reset.plantName,'Keep me');assert.equal(reset.content,legacy.content);assert.equal(reset.nozzle,.8);assert.equal(reset.backColor,'#ffffff');

const saved={style:'tag',width:75},p={name:'Saved plant',scientific_name:'Scientific',qr_url:'https://example.invalid/P/4'};assert.equal(linkedConfig(p,saved).style,'tag');assert.equal(linkedConfig(p).style,'flag');

console.log('PASS: new default, recoverable legacy draft, current draft restore, linked NAS settings preserved, default reset retains plant identity and nozzle.');



assert.equal(linkedConfig(p,{}, {width:88,reinforcement:"rounded"}).width,88);assert.equal(linkedConfig(p,{width:75},{width:88}).width,75);assert.equal(defaultFlag(legacy,{width:88}).width,88);



assert.equal(linkedConfig(p).textMode,"label");assert.equal(defaultFlag(legacy).textMode,"label");assert.equal(linkedConfig(p,{textMode:"raised"}).textMode,"raised","Explicit custom lettering remains available");

