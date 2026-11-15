// Generate fixtures using the math tool's checker and single-pass filler.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadTypeScript} from '../../slot_math/tests/helpers/typescript.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dragon=loadTypeScript(new URL('../../slot_math/src/domain/fortuneDragon.ts',import.meta.url));
const snapshot=path.join(root,'slots_service/testdata/deployments/2026-11-15-ag8/AG8'),config=JSON.parse(fs.readFileSync(path.join(snapshot,'paylines.json'),'utf8')),cases=[];
function expected(board,mode,skeleton=null){
 const e=dragon.evaluateDragon(config,board,mode),stake=107n,buyMode=cases.length%2+1,divisor=buyMode===1?5n:25n,multipliers=mode==='base'?[5]:[2,10,10],rawWin=BigInt(e.rawPayout*multipliers.reduce((a,b)=>a+b,0)),cap=2500n*divisor,paid=rawWin<cap?rawWin:cap;
 return {mode,board,raw:e.rawPayout,winningCellIds:e.winningPositions.map(i=>i+1),wins:e.wins.map(w=>({line:w.line,symbolId:w.symbolId,payout:w.payout,cellIds:w.positions.map(i=>i+1)})),stake:Number(stake),buyMode,multipliers,win:String(stake*paid/divisor),skeleton};
}
for(const mode of ['base','free']){
 const library=JSON.parse(fs.readFileSync(path.join(snapshot,mode+'-library/library.json'),'utf8'));
 for(const [key,rows] of Object.entries(library))for(const skeleton of rows){const board=dragon.fillDragonSkeleton(skeleton,config,mode,()=>0),r=expected(board,mode,skeleton);if(String(r.raw)!==key)throw Error('倍率不符');cases.push(r);}
 cases.push(expected(dragon.generateDragonLoss(config,mode,()=>0),mode));
}
for(let id=1;id<=7;id++)cases.push(expected(Array(9).fill(id),'base'));
for(const line of [[7,7,5],[7,5,7],[5,7,7]]){const board=Array(9).fill(0);[1,4,7].forEach((p,i)=>board[p]=line[i]);cases.push(expected(board,'free'));}
const target=path.join(root,'slots_service/testdata/ag8-parity.json');fs.writeFileSync(target,JSON.stringify({version:1,source:'slot_math Fortune Dragon evaluator and single-pass fill',cases})+'\n');console.log(`${cases.length} evaluation, fill and monetary parity cases: ${target}`);
