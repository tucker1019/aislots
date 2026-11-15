// Snapshot-based TypeScript/Go parity fixtures. Does not tune any probabilities.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from '../../slot_math/node_modules/typescript/lib/typescript.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(name=>load(path.resolve(path.dirname(file),name+'.ts')),m.exports,m);return m.exports;}
const ox=load(path.join(root,'slot_math/src/domain/fortuneOx.ts')),sim=load(path.join(root,'slot_math/src/domain/oxSimulation.ts'));
const snapshot=path.join(root,'slots_service/testdata/deployments/2026-11-15-ag7/AG7'),config=JSON.parse(fs.readFileSync(path.join(snapshot,'paylines.json'),'utf8')),cases=[];
function expected(board,mode,skeleton=null){const e=ox.evaluateOx(config,board,mode),stake=107n;return {mode,board,raw:e.rawPayout,jackpot:e.jackpot,fullBoard:e.fullBoard,fullSymbolId:e.fullSymbolId,fullBoardMultiplier:e.fullBoardMultiplier,winningCellIDs:e.winningPositions.map(i=>i+1),wins:e.wins.map(w=>({line:w.line,symbolId:w.symbolId,payout:w.payout,cellIds:w.positions.map(i=>i+1)})),stake:Number(stake),win:String(stake*BigInt(e.rawPayout)/10n),skeleton};}
for(const mode of ['base','free']){
 const library=JSON.parse(fs.readFileSync(path.join(snapshot,mode+'-library/library.json'),'utf8'));
 for(const [key,rows] of Object.entries(library)){
  for(const skeleton of rows){const board=ox.fillOxSkeleton(skeleton,config,mode,()=>0),r=expected(board,mode,skeleton);if(String(r.raw)!==key)throw Error('倍率不符');cases.push(r);}
 }
 cases.push(expected(ox.generateOxLoss(config,mode,()=>0),mode));
}
for(let id=1;id<=6;id++){const board=Array(10).fill(7);board[3]=id;cases.push(expected(board,'base'));}
const lengths=[];for(const draw of [1,100,101,600,601,1600,1601,4100,4101,7300,7301,9600,9601,10000])lengths.push({draw,losses:sim.oxLossCount(()=>(draw-.5)/10000)});
const target=path.join(root,'slots_service/testdata/ag7-parity.json');fs.writeFileSync(target,JSON.stringify({version:1,source:'slot_math Fortune Ox checker and single-pass fill',cases,lengths})+'\n');console.log(`${cases.length} evaluator/fill cases and ${lengths.length} length cases: ${target}`);
