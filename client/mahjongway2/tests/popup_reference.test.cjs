const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const Module=require('node:module');
const root=path.join(__dirname,'..'),assets=path.join(root,'assets');const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/popup_assets_manifest.json')));
const prefab=name=>JSON.parse(fs.readFileSync(path.join(assets,'resources/mahjong_effects/mahjongway/res/load/prefab/games',name+'.prefab')));
function nodeAt(data,p){let node=data[data[0].data.__id__];for(const name of p.split('/'))node=node?._children.map(r=>data[r.__id__]).find(n=>n._name===name);return node;}
test('native 1024 popup nodes and scripts match the runtime adapters',()=>{
 for(const [name,paths] of Object.entries({pop_free_tri:['panel/bl_icon/cnt','panel/bonus_loading','panel/bonus_lab','panel/button'],pop_free_again:['panel/bl_icon/cnt'],pop_free_end:['panel/award','panel/anim2','panel/button'],big_win:['panel/bgq/node_l_3','panel/bw_text','panel/num/award_num','panel/bw_vfx_b_add']})){
  const data=prefab(name);for(const p of paths)assert.ok(nodeAt(data,p),name+'/'+p);
  for(const n of data.filter(x=>x.__type__==='cc.Node'))for(const r of n._components){const type=data[r.__id__].__type__;assert.ok(type.startsWith('cc.')||type==='fa1638wUmZDrIAAJvGGnFR2',type);}
  for(const c of data.filter(x=>x.__type__==='cc.Button'))assert.deepEqual(c.clickEvents,[]);
 }
 assert.equal(nodeAt(prefab('big_win'),'panel/pile'),undefined);
});
test('imported images live under texture1 and exactly match reference source bytes',()=>{
 let images=0;
 for(const [file,hash] of Object.entries(manifest.binarySourceHashes)){
  if(/\.(png|jpg|jpeg|webp)$/.test(file)){assert.ok(file.startsWith('mahjongway2/res/texture1/'));images++;}
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(assets,file))).digest('hex'),hash,file);
 }
 assert.ok(images>0);
});
test('all imported serialized UUID references resolve without the old texture directory',()=>{
 const known=new Set([...Object.values(manifest.uuidMapping),...manifest.externalUUIDs]);
 function walk(o){if(Array.isArray(o)){o.forEach(walk)}else if(o&&typeof o==='object'){Object.values(o).forEach(walk)}else if(typeof o==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27}(?:@.*)?$/i.test(o)){assert.ok(known.has(o.split('@')[0]),'unresolved UUID '+o)}}
 for(const file of manifest.assets){for(const p of [path.join(assets,file),path.join(assets,file+'.meta')]){let data;try{data=JSON.parse(fs.readFileSync(p,'utf8'))}catch{continue}walk(data)}}
});
test('big win levels use 1024 titles and keep the amount scale during upgrades',()=>{
 const ts=require('../../../slot_math/node_modules/typescript');const original=Module._load;const frames=[];
 const nodes=new Map();function node(name){if(!nodes.has(name))nodes.set(name,{active:false,scale:null,setPosition(){},setScale(...v){this.scale=v},getComponent(type){return type==='opacity'?{opacity:0}:{setSpriteIndex(i){frames.push([name,i])}}},getChildByName:node});return nodes.get(name)}
 const tweens=[];Module._load=function(id,...args){if(id==='cc')return{Animation:class{},UIOpacity:'opacity',Vec3:class{},tween(target){return{to(){tweens.push(target);return this},start(){}}}};if(id==='./MWSpriteCtrl')return{MWSpriteCtrl:class{}};return original.call(this,id,...args)};
 const file=path.join(assets,'mahjongway2/src/effects/big_win_visuals.ts');const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
 try{mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file)}finally{Module._load=original}
 const effect={node:{getChildByPath:()=>node('panel'),getComponentsInChildren:()=>[]}};
 mod.exports.applyBigWinTier(effect,1);assert.equal(node('node_l_2').active,false);const count=tweens.filter(n=>n===node('num')).length;
 mod.exports.applyBigWinTier(effect,3);assert.equal(node('node_l_3').active,true);assert.equal(tweens.filter(n=>n===node('num')).length,count);assert.ok(frames.some(([name,i])=>name==='bw_text'&&i===2));
});
