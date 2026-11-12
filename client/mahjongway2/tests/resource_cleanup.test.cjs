const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
test('history art comes from the target game and carries every supported symbol and multiplier',()=>{
 const art=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/history/art.json')));const old=JSON.parse(fs.readFileSync(path.join(root,'../mahjongway/assets/resources/history/art.json')));
 assert.ok(art['1']!==old['1'],'three-dot art replaced');assert.ok(art.multiplier_background!==old.multiplier_background,'multiplier background replaced');
 for(const key of [...Array.from({length:9},(_,i)=>String(i+1)),...Array.from({length:9},(_,i)=>String(i+1001)),'10','11','wild_base','scatter_background','arrow','multiplier_free_gray_2',...[1,2,3,4,5,6,10].flatMap(n=>['multiplier_gray_'+n,'multiplier_light_'+n])])assert.match(art[key],/^data:image\/png;base64,/,key);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/history_art_manifest.json')));assert.equal(manifest.source,'mahjongway2_1024');
 for(const[key,hash]of Object.entries(manifest.images))assert.equal(crypto.createHash('sha256').update(Buffer.from(art[key].split(',')[1],'base64')).digest('hex'),hash,key);
});
test('stop arrow sprites use the second-game spin atlas',()=>{
 const prefab=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/mahjong_effects/control_stop.prefab')));
 const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/mahjongway2/res/texture1/base/c515290e-3d74-492e-977a-a2c1da85cdf0.3cec8.plist.meta')));
 for(const[name,frame]of [['sb_arrow_blur','spin_arrow_blur'],['sb_arrow_grey','spin_arrow_grey']]){
  const node=prefab.find(n=>n.__type__==='cc.Node'&&n._name===name);const sprite=node._components.map(r=>prefab[r.__id__]).find(c=>c.__type__==='cc.Sprite');
  assert.equal(sprite._spriteFrame.__uuid__,Object.values(meta.subMetas).find(x=>x.name===frame).uuid);
 }
});
test('unused first-game coin prefabs are no longer loaded or kept in the resource bundle',()=>{
 const code=fs.readFileSync(path.join(root,'assets/mahjongway2/src/effects/effect_library.ts'),'utf8');
 for(const name of['bw_particle_a','bw_particle_b']){assert.equal(code.includes("'"+name+"'"),false);assert.equal(fs.existsSync(path.join(root,'assets/resources/mahjong_effects/mahjongway/res/load/prefab/games',name+'.prefab')),false)}
});
test('scene and runtime prefab dependencies no longer reach the old texture folder',()=>{
 const assets=path.join(root,'assets'),index=new Map();
 function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)])}
 const all=files(assets);for(const p of all.filter(p=>p.endsWith('.meta'))){const m=JSON.parse(fs.readFileSync(p));if(m.uuid)index.set(m.uuid,p.slice(0,-5))}
 const queue=[path.join(assets,'mahjongway2/mahjongway2.scene'),...all.filter(p=>p.endsWith('.prefab')&&p.includes('/resources/mahjong_effects/'))],seen=new Set();
 function refs(value){if(Array.isArray(value))value.forEach(refs);else if(value&&typeof value==='object')Object.values(value).forEach(refs);else if(typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27}(?:@.*)?$/i.test(value)){const p=index.get(value.split('@')[0]);if(p)queue.push(p)}}
 while(queue.length){const p=queue.pop();if(seen.has(p))continue;seen.add(p);assert.equal(p.startsWith(path.join(assets,'mahjongway2/res/texture/')),false,p);for(const f of[p,p+'.meta']){let data;try{data=JSON.parse(fs.readFileSync(f,'utf8'))}catch{continue}refs(data)}}
});
