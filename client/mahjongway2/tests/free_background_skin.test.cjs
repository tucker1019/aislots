const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('../../../slot_math/node_modules/typescript');
const project=path.join(__dirname,'..');
function loadSkin(){const file=path.join(project,'assets/mahjongway2/src/effects/free_background_skin.ts');const original=Module._load;class Sprite{};Module._load=function(id,...args){if(id==='cc')return{Sprite};return original.call(this,id,...args)};try{const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);return m.exports.FreeBackgroundSkin;}finally{Module._load=original;}}
function node(name,frame,position={x:0,y:0,z:0}){const n={name,children:[],position:{...position},active:true,isValid:true,sprite:{spriteFrame:frame},getComponent(){return this.sprite},getChildByName(name){return this.children.find(n=>n.name===name)},setPosition(p){this.position={...p}},destroy(){this.isValid=false}};Object.defineProperty(n,'parent',{set(p){this.host?.children.splice(this.host.children.indexOf(this),1);this.host=p;p.children.push(this)},get(){return this.host}});return n;}
test('free skin swaps all five backgrounds and restores edited frames/positions on exit and release',()=>{
 const Skin=loadSkin(),root=node('Canvas'),source=node('free_background_skin'),host=node('ib_bar');host.parent=root;
 const names=['reel_a','ui_bg_a','ui_bg_b','ui_bg_c','ui_footer'];
 const targets=names.map((name,i)=>{const n=node(name,'editor-'+i,{x:i*12,y:i*30,z:0});n.parent=root;const s=node(name,'free-'+i);s.parent=source;return n;});
 for(const [name,x]of [['infoboard_lv01_mask',-322.5],['infoboard_lv01_mask-001',322.5]]){const n=node(name,'free-edge',{x,y:0,z:0});n.parent=source;}
 let destroyed=false;const skin=new Skin(root,{node:source,destroy(){destroyed=true}});
 skin.update(true);targets.forEach((n,i)=>{assert.equal(n.sprite.spriteFrame,'free-'+i);assert.equal(n.position.y,i*30)});
 assert.equal(host.children.length,2);assert.ok(host.children.every(n=>n.active));assert.deepEqual(host.children.map(n=>n.position.x),[-322.5,322.5]);
 skin.update(false);targets.forEach((n,i)=>assert.equal(n.sprite.spriteFrame,'editor-'+i));assert.ok(host.children.every(n=>!n.active));
 targets[0].sprite.spriteFrame='new-editor';skin.update(true);skin.destroy();assert.equal(targets[0].sprite.spriteFrame,'new-editor');assert.ok(destroyed);assert.ok(host.children.every(n=>!n.isValid));
});
test('background skin is loaded with free assets rather than startup dependencies',()=>{
 const file=fs.readFileSync(path.join(project,'assets/mahjongway2/src/effects/effect_library.ts'),'utf8');
 assert.match(file,/const FREE_PREFABS = \[[^\]]*'free_background_skin'/);
 const data=JSON.parse(fs.readFileSync(path.join(project,'assets/resources/mahjong_effects/free_background_skin.prefab')));
 const root=data[data[0].data.__id__];assert.equal(root._children.length,7);
 const ownership=data.filter(x=>x.__type__==='cc.PrefabInfo').map(x=>x.fileId);assert.equal(new Set(ownership).size,ownership.length,'each skin node has unique prefab ownership');
 for(const r of root._children){const n=data[r.__id__];assert.ok(n._components.some(c=>data[c.__id__].__type__==='cc.Sprite'&&data[c.__id__]._spriteFrame?.__uuid__));}
});
