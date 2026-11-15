// Explicit, reproducible initial import; never imports Lua result libraries.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const source=process.argv[2];
if(!source)throw Error('用法：node tools/import-ox-lua.mjs /path/to/1023/room.lua [new-output-directory]');
const lua=await fs.readFile(source,'utf8'),hash=createHash('sha256').update(lua).digest('hex');
if(hash!=='2d6f9cfa27bbba982da4d39b10c9e6f043b97d24428bc42a71904a7140433bdb')throw Error('1023 运行源码哈希不符；先核对数据变动，再更新导入器。');
function table(mode){const literal=lua.match(new RegExp('local win_odds_arr_'+mode+'\\s*=\\s*(\\{\\{[^\\n]+\\})'))?.[1];if(!literal)throw Error('缺少运行权重表。');return [...literal.matchAll(/\{\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\}/g)].map(m=>[Number(m[1]),Number(m[2])]);}
const normal=table('normal'),special=table('free');
if(normal.length!==78||special.length!==26||normal[0][0]!==0||normal[0][1]!==7100000)throw Error('运行表结构不符。');
const sum=rows=>rows.reduce((s,r)=>s+r[1],0),positive=normal.filter(r=>r[0]>0);
const directory=path.resolve(process.argv[3]??fileURLToPath(new URL('../../game_configs/AG7',import.meta.url)));
await fs.mkdir(directory); // Refuse to overwrite tuned files.
const files={
 base:[...positive,[20000,0]],free:special.filter(r=>r[0]>0),
 config:{version:1,ruleType:'fortune_ox_v1',parameters:{lineCount:10,baseSpinWinProbability:.29,freeSpinWinProbability:1,freeSpinTriggerProbability:.007},simulationOptions:{paidSpins:1000000,seed:1023}},
 paylines:{version:1,ruleType:'fortune_ox_v1',columnHeights:[3,4,3],lines:[[1,4,8],[1,5,8],[1,5,9],[2,5,8],[2,5,9],[2,6,9],[2,6,10],[3,6,9],[3,6,10],[3,7,10]],symbols:['鞭炮','橘子','红包','钱袋','钱箱','金元宝','金牛百搭'].map((name,i)=>({id:i+1,name,role:i===6?'wild':'normal',payout:[3,5,10,20,50,100,200][i],weight:[1000,900,850,800,750,700,300][i]})),jackpotRaw:20000,fullBoardMultiplier:10},
 'lua-1023-source':{version:1,source:path.resolve(source),sha256:hash,normalRows:normal.length,specialRows:special.length,runtimeDrawRange:10000000,normalHitProbability:.29,normalZeroWeight:7100000,normalTotalWeight:sum(normal),normalPositiveWeight:sum(positive),specialTotalWeight:sum(special),featureLength:{sourceWeights:[100,500,1000,2500,3200,2300,1600,1100,600,400,250,120,40,10],drawRange:10000,effectiveLossWeights:[[2,100],[3,500],[4,1000],[5,2500],[6,3200],[7,2300],[8,400]]},triggerProbability:.007,sourceNormal:normal,sourceSpecial:special,jackpot:{raw:20000,initialWeight:0,reason:'已确认全盘百搭按截图支付总投注2000倍；旧表无该档，初始权重0保持原概率。'},notes:'普通表取 room.lua 运行表；正倍率原权重保留，零项按运行抽样范围10000000分离为29%中奖率，正奖表内按原权重归一化。十进制求和尾差保留在来源数据。无外部调控或开奖结果库。图标形态权重取1023.lua。特殊左右六格同一个普通符号；普通与特殊互斥。特殊前段空奖次数按实际10000采样区间保留2至8次及权重100、500、1000、2500、3200、2300、400，忽略永远无法抽中的表尾。'}
};
for(const [name,value] of Object.entries(files))await fs.writeFile(path.join(directory,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log(`已创建 ${directory}；普通 ${files.base.length} 档，特殊 ${files.free.length} 档。`);
