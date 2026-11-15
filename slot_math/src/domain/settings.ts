import {validateDragonFiles,type DragonNumerical} from './dragonMath';
import { calculateModel, calculateRespinModel, validateRabbitParameters, validateRabbitTable, parseWeightTable, type FreeTriggerRule, type Parameters, type WeightRow, type WeightTable } from './model';
import {calculateOxModel} from './oxMath';
import {calculateMouseModel} from './mouseMath';

export type LoadedTable = { name: string; table: WeightTable };
export interface FreeSpinAwardInput { spins: string; weight: string }
export interface StreakRuleInput { enabled: boolean; start: string; probability: string; interval: string; step: string; cap: string }
export interface FreeTriggerRuleInput extends Omit<StreakRuleInput, 'probability'> { probability?: string; resetProbability?: string }
export interface ParameterInputs {
  featureSpins?: string; maxWinMultiplier?: string;
  freeTriggerRule?: FreeTriggerRuleInput;
  freeRetriggerLimitEnabled?: boolean; freeRetriggerLimit?: string;
  lossStreakRule?: StreakRuleInput; winStreakRule?: StreakRuleInput;
  lossStreakRtpCompensation: boolean; freeTriggerRtpCompensation: boolean;
  lineCount: string; baseSpinWinProbability: string; freeSpinWinProbability: string; freeSpinTriggerProbability: string;
  freeSpinGuaranteedWin: boolean;
  freeSpinAwards: FreeSpinAwardInput[];
}
export interface SimulationOptions { count: string; seed: string }
export interface Settings { ruleType: string; inputs: ParameterInputs; base: LoadedTable; free: LoadedTable }
export type FileParameters = Omit<Parameters, 'freeTriggerRule' | 'freeSpinsPerTrigger'> & {
  freeTriggerRule?: Omit<FreeTriggerRule, 'probability' | 'resetProbability'>;
};
export interface GameConfig {
  dragon?: DragonNumerical;
  version: 1;
  ruleType: string;
  parameters: FileParameters;
  simulationOptions: { paidSpins: number; seed: number | null };
}
export interface GameFiles { base: WeightRow[]; free: WeightRow[]; config: GameConfig }
export interface GameDocument { gameId: string; revision: string; files: GameFiles }

// Shift decimal notation rather than introducing extra rounding with * or / 100.
function percentScale(value: number, exponent: number): number {
  const [coefficient, power = '0'] = String(value).split('e');
  return Number(`${coefficient}e${Number(power) + exponent}`);
}
const inputNumber = (text: string | undefined) => text?.trim() ? Number(text) : NaN;
const inputProbability = (text: string | undefined) => percentScale(inputNumber(text), -2);

export function parametersFromFile(p: FileParameters): Parameters {
  return { ...p, freeTriggerRule: p.freeTriggerRule ? {
    ...p.freeTriggerRule, probability: Math.min(1, p.freeSpinTriggerProbability + p.freeTriggerRule.step),
  } : undefined };
}
export function parametersFromInputs(inputs: ParameterInputs): Parameters {
  const ordinaryRule = (rule?: StreakRuleInput) => {
    if (!rule) return undefined;
    const parsed = { enabled: rule.enabled, start: inputNumber(rule.start), probability: inputProbability(rule.probability), interval: inputNumber(rule.interval), step: inputProbability(rule.step), cap: inputNumber(rule.cap) };
    return !rule.enabled && Object.values(parsed).some(x => typeof x === 'number' && !Number.isFinite(x)) ? undefined : parsed;
  };
  const freeRule = inputs.freeTriggerRule;
  const freeSpinTriggerProbability = inputProbability(inputs.freeSpinTriggerProbability);
  const parsedFreeRule = freeRule ? { enabled: freeRule.enabled, start: inputNumber(freeRule.start), interval: inputNumber(freeRule.interval), step: inputProbability(freeRule.step), cap: inputNumber(freeRule.cap), probability: Math.min(1, freeSpinTriggerProbability + inputProbability(freeRule.step)) } : undefined;
  return {
    featureSpins: inputs.featureSpins === undefined ? undefined : inputNumber(inputs.featureSpins), maxWinMultiplier: inputs.maxWinMultiplier === undefined ? undefined : inputNumber(inputs.maxWinMultiplier),
    lineCount: inputNumber(inputs.lineCount),
    baseSpinWinProbability: inputProbability(inputs.baseSpinWinProbability),
    freeSpinWinProbability: inputProbability(inputs.freeSpinWinProbability), freeSpinTriggerProbability,
    freeSpinGuaranteedWin: inputs.freeSpinGuaranteedWin,
    lossStreakRtpCompensation: inputs.lossStreakRtpCompensation, freeTriggerRtpCompensation: inputs.freeTriggerRtpCompensation,
    freeSpinAwardWeights: inputs.freeSpinAwards.map(row => [inputNumber(row.spins), inputNumber(row.weight)]),
    freeRetriggerLimit: inputs.freeRetriggerLimitEnabled ? inputNumber(inputs.freeRetriggerLimit) : undefined,
    lossStreakRule: ordinaryRule(inputs.lossStreakRule), winStreakRule: ordinaryRule(inputs.winStreakRule),
    freeTriggerRule: parsedFreeRule && !parsedFreeRule.enabled && Object.values(parsedFreeRule).some(x => typeof x === 'number' && !Number.isFinite(x)) ? undefined : parsedFreeRule,
  };
}
export function settingsFromFiles(files: GameFiles): Settings {
  const p = files.config.parameters;
  const ruleInputs = (rule: Parameters['lossStreakRule']): StreakRuleInput | undefined => rule ? {
    enabled: rule.enabled, start: String(rule.start), probability: String(percentScale(rule.probability, 2)), interval: String(rule.interval), step: String(percentScale(rule.step, 2)), cap: String(rule.cap),
  } : undefined;
  return {
    ruleType: files.config.ruleType,
    base: { name: 'base.json', table: parseWeightTable(JSON.stringify(files.base)) },
    free: { name: 'free.json', table: parseWeightTable(JSON.stringify(files.free)) },
    inputs: {
      featureSpins: p.featureSpins === undefined ? undefined : String(p.featureSpins), maxWinMultiplier: p.maxWinMultiplier === undefined ? undefined : String(p.maxWinMultiplier),
      lineCount: String(p.lineCount), baseSpinWinProbability: String(percentScale(p.baseSpinWinProbability, 2)),
      freeSpinWinProbability: String(percentScale(p.freeSpinWinProbability, 2)), freeSpinTriggerProbability: String(percentScale(p.freeSpinTriggerProbability, 2)),
      freeSpinGuaranteedWin: p.freeSpinGuaranteedWin === true,
      lossStreakRtpCompensation: p.lossStreakRtpCompensation === true, freeTriggerRtpCompensation: p.freeTriggerRtpCompensation === true,
      freeRetriggerLimitEnabled: p.freeRetriggerLimit !== undefined, freeRetriggerLimit: p.freeRetriggerLimit === undefined ? '' : String(p.freeRetriggerLimit),
      freeSpinAwards: (p.freeSpinAwardWeights ?? []).map(([spins, weight]) => ({ spins: String(spins), weight: String(weight) })),
      lossStreakRule: ruleInputs(p.lossStreakRule), winStreakRule: ruleInputs(p.winStreakRule),
      freeTriggerRule: p.freeTriggerRule ? { enabled: p.freeTriggerRule.enabled, start: String(p.freeTriggerRule.start), interval: String(p.freeTriggerRule.interval), step: String(percentScale(p.freeTriggerRule.step, 2)), cap: String(p.freeTriggerRule.cap) } : undefined,
    },
  };
}
export function simulationOptionsFromFiles(files: GameFiles): SimulationOptions {
  const { paidSpins, seed } = files.config.simulationOptions;
  return { count: String(paidSpins), seed: seed === null ? '' : String(seed) };
}
function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} 必须是 JSON 对象。`);
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
export function validateGameFiles(value: unknown): GameFiles {
  object(value, '游戏文件');
  if ((value.config as {ruleType?:string})?.ruleType==='fortune_dragon_v1') return validateDragonFiles(value) as GameFiles;
  const tables = (['base', 'free'] as const).map(kind => {
    try { return parseWeightTable(JSON.stringify(value[kind])); }
    catch (error) { throw new Error(`${kind}.json：${(error as Error).message}`); }
  });
  object(value.config, 'config.json');
  const c = value.config;
  if (c.version !== 1) throw new Error('config.json：不支持的配置版本，需要 version: 1。');
  if (typeof c.ruleType !== 'string' || !/^[a-z][a-z0-9_]*_v[1-9][0-9]*$/.test(c.ruleType)) throw new Error('config.json：ruleType 必须是带版本的规则标识，例如 ways_cascade_v1。');
  object(c.parameters, 'config.json.parameters');
  const p = c.parameters;
  const isLeopard=c.ruleType==='fortune_leopard_v1';
  const isOx=c.ruleType==='fortune_ox_v1';
  const isMouse=c.ruleType==='fortune_mouse_v1';
  if(isLeopard&&(p.lineCount!==5||tables.some(t=>t.rows.some(([m])=>!Number.isSafeInteger(m)||m<=0||m>12500)||new Set(t.rows.map(([m])=>m)).size!==t.rows.length)))throw Error('AG9固定五线，倍率表只保存唯一的1～12500正整数原始倍率。');
  if((isMouse||isOx||isLeopard)&&Object.keys(p).some(k=>!['lineCount','baseSpinWinProbability','freeSpinWinProbability','freeSpinTriggerProbability'].includes(k)))throw Error('数值只保存固定线数、普通中奖率、特殊整段中奖率和触发率。');
  if(c.ruleType==='fortune_rabbit_v1'&&Object.keys(p).some(k=>!['lineCount','baseSpinWinProbability','freeSpinWinProbability','freeSpinTriggerProbability','featureSpins','maxWinMultiplier'].includes(k)))throw new Error('config.json：金兔参数只允许线数、两个中奖率、特殊触发率、固定转数和封顶倍率。');
  for (const key of ['lineCount', 'baseSpinWinProbability', 'freeSpinWinProbability', 'freeSpinTriggerProbability']) {
    if (!finite(p[key])) throw new Error(`config.json：${key} 必须是有限数字。`);
  }
  for (const key of c.ruleType === 'fortune_rabbit_v1'||isMouse||isOx||isLeopard ? [] : ['freeSpinGuaranteedWin', 'lossStreakRtpCompensation', 'freeTriggerRtpCompensation']) {
    if (typeof p[key] !== 'boolean') throw new Error(`config.json：${key} 必须是布尔值。`);
  }
  if (c.ruleType !== 'fortune_rabbit_v1' && !isMouse && !isOx && !isLeopard && !Array.isArray(p.freeSpinAwardWeights)) throw new Error('config.json：缺少免费局数权重 freeSpinAwardWeights。');
  for (const key of ['lossStreakRule', 'winStreakRule', 'freeTriggerRule']) {
    const rule = p[key];
    if (rule === undefined) continue;
    object(rule, `config.json.${key}`);
    const fields = key === 'freeTriggerRule' ? ['start', 'interval', 'step', 'cap'] : ['start', 'interval', 'step', 'cap', 'probability'];
    if (typeof rule.enabled !== 'boolean' || fields.some(field => !finite(rule[field]))) throw new Error(`config.json：${key} 的开关或参数格式无效。`);
    if (['start', 'interval', 'cap'].some(field => !Number.isSafeInteger(rule[field]) || (rule[field] as number) < 1 || (rule[field] as number) > 10000) || (rule.cap as number) < (rule.start as number) || (rule.step as number) < 0 || (rule.step as number) > 1 || (key !== 'freeTriggerRule' && ((rule.probability as number) < 0 || (rule.probability as number) > 1))) throw new Error(`config.json：${key} 的局数或概率超出范围。`);
    if (key === 'freeTriggerRule' && ('probability' in rule || 'resetProbability' in rule)) throw new Error('config.json：免费触发策略只保存 start、interval、step、cap，起始触发率由基础触发率加 step 计算。');
  }
  object(c.simulationOptions, 'config.json.simulationOptions');
  const { paidSpins, seed } = c.simulationOptions;
  if (!Number.isSafeInteger(paidSpins) || (paidSpins as number) < 1 || (paidSpins as number) > 1_000_000_000) throw new Error('config.json：模拟付费局数必须为 1 到 10 亿的整数。');
  if (seed !== null && (!Number.isSafeInteger(seed) || (seed as number) < 0 || (seed as number) > 0xffffffff)) throw new Error('config.json：种子必须为 0 到 4294967295 的整数，或 null。');
  const files = value as unknown as GameFiles;
  try { if(c.ruleType==='fortune_rabbit_v1'){validateRabbitParameters(parametersFromFile(files.config.parameters));tables.forEach(validateRabbitTable);}else (isOx?calculateOxModel:isMouse?calculateMouseModel:(files.config.ruleType==='paylines_v1'||isLeopard)?calculateRespinModel:calculateModel)(tables[0], tables[1], parametersFromFile(files.config.parameters)); }
  catch (error) { throw new Error(`config.json：${(error as Error).message}`); }
  return files;
}
export function filesFromSettings(settings: Settings, simulation: SimulationOptions): GameFiles {
  const parameters = parametersFromInputs(settings.inputs);
  if(settings.ruleType==='fortune_mouse_v1'||settings.ruleType==='fortune_ox_v1'||settings.ruleType==='fortune_leopard_v1')return validateGameFiles({base:settings.base.table.rows,free:settings.free.table.rows,config:{version:1,ruleType:settings.ruleType,parameters:{lineCount:parameters.lineCount,baseSpinWinProbability:parameters.baseSpinWinProbability,freeSpinWinProbability:parameters.freeSpinWinProbability,freeSpinTriggerProbability:parameters.freeSpinTriggerProbability},simulationOptions:{paidSpins:inputNumber(simulation.count),seed:simulation.seed.trim()?Number(simulation.seed):null}}});
  if(settings.ruleType==='fortune_rabbit_v1')return validateGameFiles({base:settings.base.table.rows,free:settings.free.table.rows,config:{version:1,ruleType:settings.ruleType,parameters:{lineCount:parameters.lineCount,baseSpinWinProbability:parameters.baseSpinWinProbability,freeSpinWinProbability:parameters.freeSpinWinProbability,freeSpinTriggerProbability:parameters.freeSpinTriggerProbability,featureSpins:parameters.featureSpins,maxWinMultiplier:parameters.maxWinMultiplier},simulationOptions:{paidSpins:inputNumber(simulation.count),seed:simulation.seed.trim()?Number(simulation.seed):null}}});
  const { freeTriggerRule, ...rest } = parameters;
  const fileParameters: FileParameters = { ...rest, freeTriggerRule: freeTriggerRule ? {
    enabled: freeTriggerRule.enabled, start: freeTriggerRule.start, interval: freeTriggerRule.interval, step: freeTriggerRule.step, cap: freeTriggerRule.cap,
  } : undefined };
  return validateGameFiles({
    base: settings.base.table.rows, free: settings.free.table.rows,
    config: { version: 1, ruleType: settings.ruleType, parameters: fileParameters, simulationOptions: { paidSpins: inputNumber(simulation.count), seed: simulation.seed.trim() ? Number(simulation.seed) : null } },
  });
}
