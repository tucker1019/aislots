const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('../../../slot_math/node_modules/typescript');const{JSDOM}=require('../../../slots_lobby/node_modules/jsdom');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const{detailBody}=require('../assets/mahjongway2/src/history/history_views.ts');
test('history renders both the native wild ingot and letters without changing other tile cells',()=>{
 const dom=new JSDOM('<div id="detail"></div>');global.document=dom.window.document;global.ResizeObserver=class{observe(){}disconnect(){}};
 const art=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/resources/history/art.json')));
 const host=document.getElementById('detail');
 const round={chargeAmount:'0',profitAmount:'0',balance:'100',cascadeFactors:['1','2','3','5'],cascadeIndex:0,mode:'base',board:[[{symbolId:10}],[{symbolId:11}],[{symbolId:2}],[{symbolId:2}],[{symbolId:2}]],previewRows:0,payouts:[],wins:[]};
 detailBody(host,{bet:{betId:'test',totalRoundCount:1,currency:'IDR'},frames:[round],amountScale:2},0,art,()=>{},()=>{},false);
 const wild=host.querySelector('.history-wild');assert.ok(wild,'wild cell has an ingot layer');assert.equal(wild.querySelectorAll('img').length,2);assert.ok(wild.querySelector('.history-wild-base').getAttribute('src')===art.wild_base);assert.ok(wild.querySelector('.history-tile').getAttribute('src')===art['10']);assert.equal(host.querySelectorAll('.history-board-column').length,5);
 dom.window.close();
});
