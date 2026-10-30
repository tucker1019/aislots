// 仅用于滚动中和装饰牌的本地采样，不决定最终盘面、中奖或结算。
export const common_spin = {
    7: 1300, //二条
    8: 1250, //五条
    5: 1200, //二筒
    6: 1150, //五筒
    1: 1100, //八万
    4: 1050, //白板
    3: 1050, //红中
    2: 1050, //发财
    9: 300, //胡
};

export const common_spin_all_widget = Object.keys(common_spin).reduce(
    (sum, key) => sum + common_spin[key],
    0,
);

export const common_gold_widget = 7; //7% 金底

type AliasTable = {
    values: number[];
    prob: Float32Array;
    alias: Uint16Array;
    n: number;
};

/** 预处理 Alias 表，使高频滚动采样不必每次遍历整张权重表。 */
function buildAliasTable(values: number[], weights: number[]): AliasTable {
    const n = values.length;
    const prob = new Float32Array(n);
    const alias = new Uint16Array(n);

    let total = 0;
    for (let i = 0; i < n; i++) {
        total += weights[i];
    }

    const small: number[] = [];
    const large: number[] = [];
    const scale = n / total;

    for (let i = 0; i < n; i++) {
        prob[i] = weights[i] * scale;
        if (prob[i] < 1) {
            small.push(i);
        } else {
            large.push(i);
        }
    }

    while (small.length > 0 && large.length > 0) {
        const s = small.pop()!;
        const l = large.pop()!;
        alias[s] = l;
        prob[l] = prob[l] + prob[s] - 1;
        if (prob[l] < 1) {
            small.push(l);
        } else {
            large.push(l);
        }
    }

    while (large.length > 0) {
        prob[large.pop()!] = 1;
    }
    while (small.length > 0) {
        prob[small.pop()!] = 1;
    }

    return { values, prob, alias, n };
}

function createAliasSampler(table: AliasTable): () => number {
    const { values, prob, alias, n } = table;
    return () => {
        const u = Math.random() * n;
        const i = u | 0;
        return u - i < prob[i] ? values[i] : values[alias[i]];
    };
}

function buildCommonWeights(): { values: number[]; weights: number[] } {
    const values: number[] = [];
    const weights: number[] = [];
    for (const key of Object.keys(common_spin)) {
        values.push(Number(key));
        weights.push(common_spin[key]);
    }
    return { values, weights };
}

function buildGoldWeights(): { values: number[]; weights: number[] } {
    const total = common_spin_all_widget;
    const goldWeight = common_gold_widget + 1000;
    const values: number[] = [];
    const weights: number[] = [];

    for (const key of Object.keys(common_spin)) {
        const symbol = Number(key);
        const weight = common_spin[key];
        if (symbol === 9) {
            values.push(symbol);
            weights.push(weight * total);
            continue;
        }
        values.push(symbol);
        weights.push(weight * (total - goldWeight));
        values.push(symbol + 1000);
        weights.push(weight * goldWeight);
    }
    return { values, weights };
}

const commonWeights = buildCommonWeights();
const goldWeights = buildGoldWeights();
const COMMON_ALIAS = buildAliasTable(commonWeights.values, commonWeights.weights);
const GOLD_ALIAS = buildAliasTable(goldWeights.values, goldWeights.weights);

const STRIP_SIZE = 256;

const pickCommonSpinCell = createAliasSampler(COMMON_ALIAS);
const pickGoldSpinCell = createAliasSampler(GOLD_ALIAS);

export type SpinCellPicker = {
    (): number;
    refill: () => void;
};

function createStripSampler(sample: () => number, startOffset: number): SpinCellPicker {
    const strip = new Int16Array(STRIP_SIZE);
    let cursor = 0;

    const refill = () => {
        for (let i = 0; i < STRIP_SIZE; i++) {
            strip[i] = sample();
        }
        cursor = startOffset % STRIP_SIZE;
    };

    const pick = (() => {
        const value = strip[cursor];
        cursor++;
        if (cursor >= STRIP_SIZE) {
            cursor = 0;
        }
        return value;
    }) as SpinCellPicker;

    pick.refill = refill;
    refill();

    return pick;
}

export function createSpinCellPicker(index: number): SpinCellPicker {
    const sample = index >= 1 && index <= 3 ? pickGoldSpinCell : pickCommonSpinCell;
    return createStripSampler(sample, index * 17);
}

export function getRandomSpinCell(index: number): number {
    return createSpinCellPicker(index)();
}
