const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {setStopArtwork}=require('../assets/mahjongway/src/effects/stop_control.ts');
test('Stop点击后切换原生灰色图片，下轮恢复，重复同步不改变状态',()=>{
 const nodes={sb_arrow_blur:{active:true},sb_arrow_grey:{active:false}};
 const root={getChildByPath:p=>nodes[p]};
 setStopArtwork(root,true);assert.equal(nodes.sb_arrow_blur.active,false);assert.equal(nodes.sb_arrow_grey.active,true);
 setStopArtwork(root,true);assert.equal(nodes.sb_arrow_grey.active,true);
 setStopArtwork(root,false);assert.equal(nodes.sb_arrow_blur.active,true);assert.equal(nodes.sb_arrow_grey.active,false);
});
