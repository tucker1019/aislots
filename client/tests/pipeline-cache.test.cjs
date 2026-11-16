const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('../../slots_lobby/node_modules/typescript');
for(const project of ['mahjongway','mahjongway2','showdown','fortunetiger','fortunerabbit','fortunemouse','fortuneox','fortunedragon'])test(`${project}: pipeline binary cache key changes with build settings`,()=>{
 const file=path.resolve(__dirname,'..',project,'build-templates/web-mobile/index.js.ejs');
 assert(fs.existsSync(file),'startup template must register pipeline cache protection');
 const source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='versionPipelineCache');assert(fn);
 const box={exports:{}};vm.runInNewContext(fn.getText(tree)+';exports.run=versionPipelineCache;',box);
 function run(settingsPath,value){let callback,output;const engine={game:{onPostBaseInitDelegate:{add(fn){callback=fn;}}},settings:{querySettings(group,key){assert.equal(group,'rendering');assert.equal(key,'effectSettingsPath');return value;},overrideSettings(group,key,next){output=next;}}};
  box.exports.run(engine,settingsPath);assert.equal(output,undefined,'wait for settings initialization');assert(callback);callback();return output;}
 const first=run('src/settings.385.json','src/effect.bin'),second=run('src/settings.388.json','src/effect.bin');
 assert.notEqual(first,second);assert(first.startsWith('src/effect.bin?build='));
 assert.equal(new URL(first,'https://example.com/').searchParams.get('build'),'src/settings.385.json');
 assert(run('src/settings.test.json','src/effect.bin?existing=1').includes('&build='));
 assert.equal(run('src/settings.test.json',undefined),undefined);
 assert(source.includes('versionPipelineCache(engine, application.settingsPath)'),'startup must install the hook');
});
