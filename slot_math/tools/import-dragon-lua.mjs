// Explicit initial numerical import. Refuses to overwrite saved tuning.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const source=process.argv[2];
if(!source)throw Error('用法：node tools/import-dragon-lua.mjs /path/to/slotCfg_1048.lua [new-output-directory]');
const lua=await fs.readFile(source,'utf8');
const sourceHash=createHash('sha256').update(lua).digest('hex');
if(sourceHash!=='60f46259fa0694e7631668115459d3d8cd63b24b0c436ac4028a9c11a37ef372')throw Error('1048源码已改变，需先核对倍率表和规则再更新导入器。');
function table(name){const assignment=lua.indexOf('slotCfg.'+name+' =');if(assignment<0)throw Error('缺少配置表 '+name);const start=lua.indexOf('{',assignment);if(start<0)throw Error('缺少配置表 '+name);let depth=0,end=start;for(;end<lua.length;end++){if(lua[end]==='{')depth++;if(lua[end]==='}'&&--depth===0)break;}const literal=lua.slice(start,end+1),rows=[...literal.matchAll(/\{\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\}/g)].map(m=>[Number(m[1]),Number(m[2])]);if(!rows.length)throw Error('空配置表 '+name);return rows;}
const sourceTables=Object.fromEntries(['rates_normal','rates_free','rates_5x_normal','rates_5x_free','normal_mul','free_num','free_mul'].map(name=>[name,table(name)]));
const split=rows=>({positive:rows.filter(([m])=>m>0),hit:rows.filter(([m])=>m>0).reduce((s,r)=>s+r[1],0)/rows.reduce((s,r)=>s+r[1],0)});
const base=split(sourceTables.rates_normal),free=split(sourceTables.rates_free),boostBase=split(sourceTables.rates_5x_normal),boostFree=split(sourceTables.rates_5x_free);
const dir=path.resolve(process.argv[3]??fileURLToPath(new URL('../../game_configs/AG8',import.meta.url)));await fs.mkdir(dir);
const files={base:base.positive,free:free.positive,config:{version:1,ruleType:'fortune_dragon_v1',parameters:{lineCount:5,baseSpinWinProbability:base.hit,freeSpinWinProbability:free.hit,freeSpinTriggerProbability:0.0066,featureSpins:8,maxWinMultiplier:2500},simulationOptions:{paidSpins:1000000,seed:1048},dragon:{normalMultipliers:sourceTables.normal_mul,freeMultiplierCounts:sourceTables.free_num,freeMultipliers:sourceTables.free_mul,boost:{base:boostBase.positive,free:boostFree.positive,baseWinProbability:boostBase.hit,freeWinProbability:boostFree.hit}}},paylines:{version:1,ruleType:'fortune_dragon_v1',columnHeights:[3,3,3],lines:[[2,5,8],[1,4,7],[3,6,9],[1,5,9],[3,5,7]],symbols:['铜钱','中国结','鞭炮','灯笼','红包','金元宝','金龙百搭'].map((name,i)=>({id:i+1,name,role:i===6?'wild':'normal',payout:[2,3,5,10,25,50,100][i],weight:[1150,1100,1050,950,880,750,300][i]}))},'lua-1048-source':{version:1,source:path.resolve(source),sha256:sourceHash,sourceTables,changes:['八次全空仍展示八次，不降级成普通空奖','按实际扣款2500倍截断，达到后立即结束'],notes:'只导入明确授权的初始倍率概率与图标权重，不导入结果库或外部调控器。零倍率从表分离为中奖率；保留原正奖权重并按实际总和归一化。普通/免费互斥；底部免费倍率相加。五倍模式实际扣款除25作为单线投注，普通除5。'}};
for(const [name,value] of Object.entries(files))await fs.writeFile(path.join(dir,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({dir,rows:[base.positive.length,free.positive.length,boostBase.positive.length,boostFree.positive.length],hit:[base.hit,free.hit,boostBase.hit,boostFree.hit]}));
