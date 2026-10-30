export const number = (x: number, digits = 6) => x.toLocaleString('en-US', { maximumFractionDigits: digits });
export const times = (x: number) => `${x > 0 && x < 1e-8 ? x.toExponential(4) : number(x, 8)}×`;
