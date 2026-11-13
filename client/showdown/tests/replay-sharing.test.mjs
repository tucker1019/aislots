import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from '../../../slot_math/node_modules/typescript/lib/typescript.js';
const compile=p=>ts.transpile(fs.readFileSync(new URL('../assets/wildbountyshowdown/src/history/'+p,import.meta.url),'utf8'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const shares=await import(url(compile('replay_share.ts').replace("from './history_dom'",`from '${url(compile('history_dom.ts'))}'`)));
test('share links strip session and private replay channel',()=>{const u=new URL(shares.replayShareURL('http://127.0.0.1:5193/?nativeReplay=private&token=secret&uid=1&sid=secret&launchTicket=secret&api=http%3A%2F%2F127.0.0.1%3A5193','order','public'));assert.deepEqual(Array.from(u.searchParams.keys()).sort(),['api','replay','share']);assert.equal(u.searchParams.get('share'),'public');});
test('blocked clipboard policy never calls Clipboard API and offers a selectable fallback',async(t)=>{
 let attempts=0;const nodes=[];const make=tag=>{const n={tag,style:{},children:[],handlers:{},setAttribute(){},append(...items){this.children.push(...items);},addEventListener(type,fn){this.handlers[type]=fn;},select(){this.selected=true;},remove(){}};nodes.push(n);return n;};
 const oldDocument=globalThis.document,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 globalThis.document={createElement:make,featurePolicy:{allowsFeature:()=>false},execCommand:()=>true};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{attempts++;}}}});
 t.after(()=>{globalThis.document=oldDocument;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;});
 assert.equal(await shares.copyReplayLink('https://example.test/?share=public',make('host')),false);assert.equal(attempts,0);assert.equal(nodes.find(n=>n.tag==='input').selected,true);assert.match(nodes.find(n=>n.style.cssText?.includes('pointer-events')).style.cssText,/pointer-events:auto/);
});
