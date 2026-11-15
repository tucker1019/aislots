// Uses the developer page's generator and the normal revision-checked save API.
import fs from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function load(url){if(cache.has(url.href))return cache.get(url.href);const m={exports:{}};cache.set(url.href,m.exports);new Function('require','exports','module',ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(p=>load(new URL(p+'.ts',url)),m.exports,m);return m.exports;}
const {OxSkeletonGenerator,validateOxLibrary,oxCoverage}=load(new URL('../src/domain/fortuneOx.ts',import.meta.url));
const origin=process.argv[2]??'http://127.0.0.1:5196';
async function request(route,options){const r=await fetch(origin+'/__game-files/games/AG7'+route,options);const v=await r.json();if(!r.ok)throw Error(JSON.stringify(v));return v;}
const game=await request(''),board=await request('/paylines');
for(const mode of ['base','free']){
 const targets=game.files[mode].filter(([m,w])=>m>0&&w>0).map(([m])=>m);if(mode==='base')targets.push(20000);
 const generator=new OxSkeletonGenerator(board.file,{mode,count:1000000,seed:1023,perMultiplier:3,maxRetained:15000},targets);
 while(!generator.done)generator.step();const library=generator.result();validateOxLibrary(library,board.file);const coverage=oxCoverage(library,game.files[mode]);if(coverage.missing.length)throw Error('缺失倍率：'+coverage.missing.join(','));
 const saved=await request('/paylines/library',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:board.revision,file:{...library,gameRevision:game.revision}})});
 console.log(JSON.stringify({mode,...saved,generated:library.stats.generated}));
}
