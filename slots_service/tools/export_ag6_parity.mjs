// Snapshot-based TypeScript/Go parity fixtures. Does not tune any probabilities.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from '../../slot_math/node_modules/typescript/lib/typescript.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(name=>load(path.resolve(path.dirname(file),name+'.ts')),m.exports,m);return m.exports;}
const mouse=load(path.join(root,'slot_math/src/domain/fortuneMouse.ts')),sim=load(path.join(root,'slot_math/src/domain/mouseSimulation.ts'));
const snapshot=path.join(root,'slots_service/testdata/deployments/2026-11-15-ag6/AG6'),config=JSON.parse(fs.readFileSync(path.join(snapshot,'paylines.json'),'utf8')),cases=[];
function expected(board,mode,skeleton=null){const e=mouse.evaluateMouse(config,board,mode),stake=107n;return {mode,board,raw:e.rawPayout,jackpot:e.jackpot,winningCellIDs:e.winningPositions.map(i=>i+1),wins:e.wins.map(w=>({line:w.line,symbolId:w.symbolId,payout:w.payout,cellIds:w.positions.map(i=>i+1)})),stake:Number(stake),win:String(stake*BigInt(e.rawPayout)/5n),skeleton};}
for(const mode of ['base','free']){
 const library=JSON.parse(fs.readFileSync(path.join(snapshot,mode+'-library/library.json'),'utf8'));
 for(const [key,rows] of Object.entries(library)){
  const board=mouse.fillMouseSkeleton(rows[0],config,mode,()=>0),r=expected(board,mode,rows[0]);if(String(r.raw)!==key)throw Error('倍率不符');cases.push(r);
 }
 cases.push(expected(mouse.generateMouseLoss(config,mode,()=>0),mode));
}
const lengths=[];for(const raw of [3,74,75,199,200,499,500,5000])for(const draw of [1,149,150,749,750,1049,1050,1200])lengths.push({raw,draw,losses:sim.mouseLossCount(raw,()=>(draw-.5)/1200)});
const target=path.join(root,'slots_service/testdata/ag6-parity.json');fs.writeFileSync(target,JSON.stringify({version:1,source:'slot_math Fortune Mouse checker and single-pass fill',cases,lengths})+'\n');console.log(`${cases.length} evaluator/fill cases and ${lengths.length} length cases: ${target}`);
