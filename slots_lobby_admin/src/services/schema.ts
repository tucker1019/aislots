export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type RecordValue = Record<string, unknown>;
export function object(value: unknown): RecordValue {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('接口数据格式异常：应为对象');
 return value as RecordValue;
}
export function string(value: unknown): string {
 if (typeof value !== 'string') throw new Error('接口数据格式异常：应为字符串');
 return value;
}
export function integer(value: unknown): number {
 if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('接口数据格式异常：应为整数');
 return value;
}
export function amount(value: unknown): string {
 const result = string(value);
 if (!/^-?\d+$/.test(result)) throw new Error('接口金额格式异常');
 return result;
}
export function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
 if (!Array.isArray(value)) throw new Error('接口数据格式异常：应为列表');
 return value.map(parse);
}
export function json(value: unknown): Json {
 if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
 if (typeof value === 'number' && Number.isFinite(value)) return value;
 if (Array.isArray(value)) return value.map(json);
 return Object.fromEntries(Object.entries(object(value)).map(([key, item]) => [key, json(item)]));
}
export function optionalString(value: unknown): string { return value == null ? '' : string(value); }
export function boolean(value: unknown): boolean {
 if (typeof value !== 'boolean') throw new Error('接口布尔字段格式异常');
 return value;
}
export function page<T>(value: unknown, parse: (item: unknown) => T) {
 const data = object(value);
 return { items: array(data.items, parse), nextCursor: optionalString(data.nextCursor) };
}
