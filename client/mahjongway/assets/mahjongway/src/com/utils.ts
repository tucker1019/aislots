import { DEBUG, DEV } from 'cc/env';

// 仅在编辑器或开发构建输出调试日志。
export const printDebug = (...message: any[]) => {
    if (DEBUG || DEV) {
        console.log(...message);
    }
};

export const getCoinLab = (coin: number) => {};
