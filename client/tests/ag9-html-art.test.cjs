const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../fortuneleopard');
test('AG9 history packages every original symbol with its actual client ID',()=>{
 const art=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/history/art.json')));
 const names=['juzi','pao','hongbao','fudai','ruyi','yuanbao','wild'];
 assert.equal(Object.keys(art).length,8);
 for(let id=1;id<=7;id++)assert.deepEqual(Buffer.from(art[id].split(',')[1],'base64'),fs.readFileSync(path.join(root,'assets/resources/res/image/games/symbol',names[id-1]+'.png')));
});
test('AG9 rules images exist in both editor preview and web build templates',()=>{
 const files=['wild','yuanbao','ruyi','fudai','hongbao','pao','juzi'].map(name=>name+'.png').concat(['paytable_features.png','paytable_multiplier_feature.png','paytable_payline.png']);
 for(const name of files){
  const preview=fs.readFileSync(path.join(root,'preview-template/rules',name));
  const build=fs.readFileSync(path.join(root,'build-templates/web-mobile/rules',name));
  assert.deepEqual(preview,build);
  assert.equal(preview.subarray(1,4).toString(),'PNG');
 }
 const source=fs.readFileSync(path.join(root,'assets/fortuneleopard/src/game/ui/rules_page.ts'),'utf8');
 assert.doesNotMatch(source,/normal_symbol|wild_symbol|createElementNS/);
});
