import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from '../../../slot_math/node_modules/typescript/lib/typescript.js';
const read=p=>fs.readFileSync(new URL('../assets/wildbountyshowdown/src/'+p,import.meta.url),'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpile(s,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
test('errors distinguish reconnect, insufficient funds and expired sessions without exposing raw errors',async()=>{
 const {gameErrorMessage}=await import(url(compile(read('ui/dialog_message.ts'))));
 assert.equal(gameErrorMessage(new TypeError('Failed to fetch')).title,'请求失败');
 assert.equal(gameErrorMessage({status:402,message:'insufficient balance'}).title,'余额不足');
 assert.equal(gameErrorMessage({status:401,message:'secret session'}).expired,true);
 assert.doesNotMatch(JSON.stringify(gameErrorMessage(Error('private stack trace'))),/private/);
});
test('HTML dialogs dispatch once, clean up and never insert message HTML',async(t)=>{
 const nodes=[];const make=tag=>{const n={tag,style:{},dataset:{},children:[],handlers:{},disabled:false,setAttribute(){},removeAttribute(){},append(...v){this.children.push(...v);},addEventListener(k,fn){this.handlers[k]=fn;},remove(){this.removed=true;},focus(){}};nodes.push(n);return n;};
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={createElement:make,body:make('body'),getElementById:()=>({})};globalThis.window={setTimeout,clearTimeout};
 t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
 const source=compile(read('ui/game_dialogs.ts')).replace(/import .*from ['"]\.\/game_overlay['"];?/, 'const fitGameOverlay=()=>()=>{};');
 const {showGameDialog}=await import(url(source));let calls=0;
 const close=showGameDialog({title:'余额不足',message:'<img src=x>',actions:[{label:'确定',run:()=>calls++}]});
 assert.equal(nodes.find(n=>n.tag==='p').textContent,'<img src=x>');
 const b=nodes.find(n=>n.tag==='button');b.handlers.click();b.handlers.click();assert.equal(calls,1);close();
});
test('funds, unfinished round and busy-exit warnings use HTML rather than missing prefab',()=>{
 const mgr=read('wbsgame/mgr/WBSLoadManager.ts');assert.match(mgr,/showGameDialog/);assert.doesNotMatch(mgr,/AlertLayer|prefab\/com\/Toast/);
 assert.match(read('wbsgame/view/WBSOptLayer.ts'),/showAlert\('余额不足'/);
 assert.match(read('wbsgame/view/WBSGameLayer.ts'),/showAlert\('继续未完成的游戏'/);
 assert.match(read('network/error_overlay.ts'),/showGameDialog/);
});
