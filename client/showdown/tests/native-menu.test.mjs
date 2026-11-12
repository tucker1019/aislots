import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from '../../../slot_math/node_modules/typescript/lib/typescript.js';
test('3.8.8 menu transition activates the target before tween and restores scene y',()=>{
 const text=fs.readFileSync(new URL('../assets/wildbountyshowdown/src/wbsgame/view/WBSOptLayer.ts',import.meta.url),'utf8');const file=ts.createSourceFile('view.ts',text,ts.ScriptTarget.Latest,true);let body;
 function visit(node){if(ts.isMethodDeclaration(node)&&node.name.getText(file)==='changePanel')body=node.body.getText(file);ts.forEachChild(node,visit);}visit(file);
 const tween=target=>{const queue=[];const api={to(_time,value){queue.push(()=>Object.assign(target,value));return api;},delay(){return api;},call(fn){queue.push(fn);return api;},start(){if(target.active!==false)queue.forEach(fn=>fn());return api;}};return api;};
 class Vec3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 const method=new Function('tween','Tween','Vec3','return function(id)'+body)(tween,{stopAllByTarget(){}},Vec3);
 const state={panel1:{active:true,position:new Vec3(0,-46,0)},panel2:{active:false,position:new Vec3(0,-46,0)},panelRestY:-46};
 method.call(state,2);assert.equal(state.panel2.active,true);assert.equal(state.panel2.position.y,-46);assert.equal(state.panel1.active,false);
 method.call(state,1);assert.equal(state.panel1.active,true);assert.equal(state.panel1.position.y,-46);assert.equal(state.panel2.active,false);
});
