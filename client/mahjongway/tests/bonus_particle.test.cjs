const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/mahjongway/src/effects/game_effects.ts'),'utf8');
const body=source.match(/private updateBonusParticle\(visible: boolean\) \{([\s\S]*?)\n    \}/)[1];
const update=new Function('visible','Animation',body);
test('免费阶段只启动一次原生循环，退出停止隐藏，再次进入重置播放',()=>{
 const calls=[];const state={bonusParticleVisible:false,bonusParticle:{reset:()=>calls.push('reset'),loops:()=>calls.push('loop'),hide:()=>calls.push('hide'),node:{getComponent:()=>({stop:()=>calls.push('stop')})}}};
 update.call(state,false,{});assert.deepEqual(calls,[]);
 update.call(state,true,{});update.call(state,true,{});assert.deepEqual(calls,['reset','loop']);
 update.call(state,false,{});assert.deepEqual(calls,['reset','loop','stop','hide']);
 update.call(state,true,{});assert.deepEqual(calls.slice(-2),['reset','loop']);
});
test('使用目标上方节点的原生循环和姿态，不混入业务脚本',()=>{
 const root=path.join(__dirname,'../assets/resources/mahjong_effects');
 const prefab=JSON.parse(fs.readFileSync(path.join(root,'bonus_bg_particle.prefab'),'utf8'));
 const node=prefab.find(x=>x.__type__==='cc.Node'&&x._name==='bonus_bg_particle');
 assert.equal(node._active,false);assert.equal(node._lscale.y,-1.7);assert.equal(node._lpos.y,624.53);
 const anim=prefab.find(x=>x.__type__==='cc.Animation');
 const clip=JSON.parse(fs.readFileSync(path.join(root,'mahjongway/res/animation/bonus_bg_particle.anim'),'utf8'))[0];
 assert.equal(clip.wrapMode,2);assert.equal(clip.speed,0.2);assert.equal(anim.playOnLoad,true);
 assert.ok(prefab.every(x=>x.__type__.startsWith('cc.')));
});
