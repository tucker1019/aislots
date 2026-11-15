// Import numerical inputs only. Outcome libraries are generated locally.
import fs from 'node:fs';
const source=fs.readFileSync(process.argv[2]??'/Users/zhaoyao/game_lua/game/service/qd/1021/room.lua','utf8');
const root=new URL('../../game_configs/AG9/',import.meta.url);
fs.mkdirSync(root,{recursive:true});
const probabilities={};
for(const [mode,name] of [['base','normal'],['free','free']]){
 const text=source.match(new RegExp('local win_odds_arr_'+name+'\\s*=\\s*(\\{[^\\n]+)'))?.[1];
 if(!text)throw Error('未找到1021倍率表');
 const rows=[...text.matchAll(/\{\s*([\d.]+)\s*,\s*([\d.]+)\s*\}/g)].map(m=>[Number(m[1]),Number(m[2])]);
 const total=rows.reduce((s,[,w])=>s+w,0),positive=rows.filter(([m,w])=>m>0&&w>0);
 probabilities[mode]=positive.reduce((s,[,w])=>s+w,0)/total;
 let output=positive;
 if(mode==='free'){
  fs.writeFileSync(new URL('free.lua-reference.json',root),JSON.stringify(positive,null,2)+'\n',{flag:'wx'});
  const weights=new Map(positive);
  for(const [m,lo,hi] of [[45,40,50],[120,100,150],[375,350,400],[1500,1250,2620]]){
   const w=weights.get(m);if(w===undefined)throw Error('旧表与已确认修正方案不匹配');weights.delete(m);
   weights.set(lo,(weights.get(lo)??0)+w*(hi-m)/(hi-lo));weights.set(hi,(weights.get(hi)??0)+w*(m-lo)/(hi-lo));
  }
  output=[...weights].sort((a,b)=>a[0]-b[0]);
  fs.writeFileSync(new URL('free.proposed.json',root),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 }
 fs.writeFileSync(new URL(mode+'.json',root),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
}
const config={version:1,ruleType:'fortune_leopard_v1',parameters:{lineCount:5,baseSpinWinProbability:probabilities.base,freeSpinWinProbability:probabilities.free,freeSpinTriggerProbability:.015},simulationOptions:{paidSpins:1000000,seed:1021}};
fs.writeFileSync(new URL('config.json',root),JSON.stringify(config,null,2)+'\n',{flag:'wx'});
const board={version:1,ruleType:'paylines_v1',columnHeights:[3,3,3],lines:[[2,5,8],[1,4,7],[3,6,9],[1,5,9],[3,5,7]],symbols:['橘子','鞭炮','红包','福袋','如意','金元宝','幸运豹百搭'].map((name,i)=>({id:i+1,name,role:i===6?'wild':'normal',payout:[3,5,8,10,25,100,250][i],weight:[1000,950,950,800,550,500,200][i]})),feature:{fillProbability:.2,targetWeights:[1000,900,800,700,600,500].map((weight,i)=>({symbolId:i+1,weight})),baseSpreadWeights:[50,35,15]}};
board.symbols.find(s=>s.role==='wild').name='幸运豹百搭';
board.feature={...board.feature,type:'fortune_leopard_v1',wildProbability:.1};
fs.writeFileSync(new URL('paylines.json',root),JSON.stringify(board,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({gameId:'AG9',probabilities,trigger:.015}));
