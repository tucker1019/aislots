// Explicit, reproducible initial import; never imports Lua result libraries.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const source=process.argv[2];
if(!source)throw Error('用法：node tools/import-mouse-lua.mjs /path/to/1019/room.lua [new-output-directory]');
const lua=await fs.readFile(source,'utf8'),hash=createHash('sha256').update(lua).digest('hex');
if(hash!=='d5b4f88b0b462854160c07b5c80c3f8083854c7f230b9bdd31e38cbed7cb1b1c')throw Error('1019 运行源码哈希不符；先核对数据变动，再更新导入器。');
function table(mode){const literal=lua.match(new RegExp('local win_odds_arr_'+mode+'\\s*=\\s*(\\{\\{[^\\n]+\\})'))?.[1];if(!literal)throw Error('缺少运行权重表。');return [...literal.matchAll(/\{\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\}/g)].map(m=>[Number(m[1]),Number(m[2])]);}
const normal=table('normal'),special=table('free');
if(normal.length!==313||special.length!==268||normal[0][0]!==0||normal[0][1]!==7200000)throw Error('运行表结构不符。');
const sum=rows=>rows.reduce((s,r)=>s+r[1],0),positive=normal.filter(r=>r[0]>0);
const directory=path.resolve(process.argv[3]??fileURLToPath(new URL('../../game_configs/AG6',import.meta.url)));
await fs.mkdir(directory); // Refuse to overwrite tuned files.
const files={
 base:[...positive,[5000,0]],free:[...special.filter(r=>r[0]>0),[5000,0]],
 config:{version:1,ruleType:'fortune_mouse_v1',parameters:{lineCount:5,baseSpinWinProbability:.28,freeSpinWinProbability:1,freeSpinTriggerProbability:.014},simulationOptions:{paidSpins:1000000,seed:1019}},
 paylines:{version:1,ruleType:'fortune_mouse_v1',columnHeights:[3,3,3],lines:[[2,5,8],[1,4,7],[3,6,9],[1,5,9],[3,5,7]],symbols:['花生','橘子','鞭炮','钱袋','红包','金色鼠纹牌','老鼠百搭'].map((name,i)=>({id:i+1,name,role:i===6?'wild':'normal',payout:[3,5,15,30,50,100,300][i],weight:[1000,900,850,800,750,700,300][i]})),jackpotRaw:5000},
 'lua-1019-source':{version:1,source:path.resolve(source),sha256:hash,normalRows:normal.length,specialRows:special.length,runtimeDrawRange:10000000,normalHitProbability:.28,normalZeroWeight:7200000,normalTotalWeight:sum(normal),normalPositiveWeight:sum(positive),specialTotalWeight:sum(special),triggerProbability:.014,sourceNormal:normal,sourceSpecial:special,jackpot:{raw:5000,initialWeight:0,reason:'规则图全盘百搭总投注1000倍；原表没有该档。'},notes:'普通表取 room.lua 运行表；正倍率原权重保留，零项按运行抽样范围10000000分离为28%中奖率，正奖表内按原权重归一化。十进制求和尾差保留在来源数据。原始1000档保留。无外部调控或开奖结果库。图标形态权重取1019.lua。'}
};
for(const [name,value] of Object.entries(files))await fs.writeFile(path.join(directory,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log(`已创建 ${directory}；普通 ${files.base.length} 档，特殊 ${files.free.length} 档。`);
