// Reproduce AG5 inputs. Prints an apply_patch document; never overwrites files itself.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const source=path.resolve(process.argv[2] ?? '../../game_lua/game/service/qd/1018/room.lua');
const lua=fs.readFileSync(source,'utf8');
const literal=lua.match(/local win_odds_arr_normal\s*=\s*(\{\{[^\n]+\})/)[1];
const rows=[...literal.matchAll(/\{\s*([\d.]+)\s*,\s*([\d.]+)\s*\}/g)].map(m=>[Number(m[1]),Number(m[2])]);
if(rows.length<1000||!lua.match(/local win_odds_arr_free\s*=\s*\{\{\s*\}\}/))throw Error('Lua 表结构变化，需要重新核对。');
const all=rows.reduce((s,r)=>s+r[1],0),positive=rows.filter(r=>r[0]>0),positiveWeight=positive.reduce((s,r)=>s+r[1],0);
const values=[5,10,20,50,100,200,500,1000,2000];
const sourceWeights=[101548.19175,35489.50974,12403.03033,3090.09758,1079.94093,377.42252,94.03125,32.86245,11.48492];
// Runtime draws over 154126, not the sum of the weights. Clip the last interval.
let remaining=154126;
const weights=sourceWeights.map(w=>{const actual=Math.max(0,Math.min(remaining,w));remaining-=actual;return actual;});
const rewards=values.map((v,i)=>({id:11+i,name:`奖励 ${v/10} 倍`,payout:v,weight:weights[i]}));
let distribution=new Map([[0,1]]),free=new Map();
const choose=(n,k)=>{let v=1;for(let j=1;j<=k;j++)v=v*(n-j+1)/j;return v;};
let hit=0;
for(let n=1;n<=10;n++){
 const next=new Map();
 for(const [sum,p] of distribution)for(let i=0;i<values.length;i++)next.set(sum+values[i],(next.get(sum+values[i])??0)+p*weights[i]/154126);
 distribution=next;
 if(n<5)continue;
 const probability=choose(10,n)*.4**n*.6**(10-n);hit+=probability;
 for(const [sum,p] of distribution)free.set(sum,(free.get(sum)??0)+probability*p);
}
const config={version:1,ruleType:'fortune_rabbit_v1',parameters:{lineCount:10,baseSpinWinProbability:positiveWeight/all,freeSpinWinProbability:hit,freeSpinTriggerProbability:.006,featureSpins:8,maxWinMultiplier:5000},simulationOptions:{paidSpins:1000000,seed:1018}};
const paylines={version:1,ruleType:'fortune_rabbit_v1',columnHeights:[3,4,3],lines:[[1,4,8],[1,5,8],[1,5,9],[2,5,8],[2,5,9],[2,6,9],[2,6,10],[3,6,9],[3,6,10],[3,7,10]],symbols:[2,3,5,10,50,100,200].map((payout,i)=>({id:i+1,name:['胡萝卜','烟花','铜钱','红包','福袋','金兔','百搭'][i],role:i===6?'wild':'normal',payout,weight:i===6?100:1000})),rewards,generation:{rewardProbability:.4}};
const provenance={version:1,source:'game_lua/game/service/qd/1018/room.lua',sha256:createHash('sha256').update(lua).digest('hex'),normalRows:rows.length,sourceTotalWeight:all,sourceZeroWeight:all-positiveWeight,baseMeaning:'单次普通中奖总原始倍率；去掉零项，零项概率迁移为普通中奖率。',freeMeaning:'单次特殊中奖总原始倍率；十格独立生成，至少五个奖励才支付全部奖励，精确离散卷积后分离零奖。',specialHitProbability:hit,specialCellProbability:.4,sourceRewardWeights:sourceWeights,effectiveRewardWeights:weights,sourceRandomRange:154126,unusedReward:{id:20,payout:5000},differences:['按用户规则先结算普通局再独立触发八次特殊转；Lua 原流程普通与特殊二选一。','普通图标形态权重为开发初值，只影响骨架形态；奖金分布取自倍率表。','5000 倍整局封顶，特殊转不保留奖励符号。']};
const files={'base.json':positive,'free.json':[...free].sort((a,b)=>a[0]-b[0]).map(([sum,p])=>[sum,p/hit]),'config.json':config,'paylines.json':paylines,'lua-1018-source.json':provenance};
let patch='*** Begin Patch\n';
for(const [name,value] of Object.entries(files)){
 const target=path.resolve('../game_configs/AG5',name);
 if(fs.existsSync(target))throw Error(`${target} 已存在，禁止覆盖；先核对差异。`);
 patch+=`*** Add File: ${target}\n`+JSON.stringify(value,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n';
}
process.stdout.write(patch+'*** End Patch\n');
