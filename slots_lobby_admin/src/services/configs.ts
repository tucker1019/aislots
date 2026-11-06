import { request } from './client';
import { array, boolean, integer, json, object, optionalString, string } from './schema';
import type { Json } from './schema';
function parseSummary(value: unknown) {
 const d = object(value);
 return { key: string(d.key), label: string(d.label), description: string(d.description), publishedVersion: integer(d.publishedVersion), draftVersion: integer(d.draftVersion), hasDraft: boolean(d.hasDraft) };
}
export const getConfigs = () => request('/configs', v => array(object(v).items, parseSummary));
function parseConfig(value: unknown) {
 const d = object(value);
 return { key: string(d.key), label: string(d.label), published: json(d.published), draft: json(d.draft), publishedVersion: integer(d.publishedVersion), draftVersion: integer(d.draftVersion), history: array(d.history, value => {
  const h = object(value); return { version: integer(h.version), status: string(h.status), username: string(h.username), createdAt: string(h.createdAt), reason: optionalString(h.reason) };
 }) };
}
export type Config = ReturnType<typeof parseConfig>;
const path = (key: string) => `/configs/${encodeURIComponent(key)}`;
export const getConfig = (key: string) => request(path(key), parseConfig);
export const saveDraft = (key: string, document: Json, expectedVersion: number, reason: string) => request(`${path(key)}/draft`, parseConfig, { document, expectedVersion, reason });
export const validateConfig = (key: string, document: Json) => request(`${path(key)}/validate`, v => {
 if (object(v).valid !== true) throw new Error('配置校验未通过'); return true;
}, { document });
export const publishConfig = (key: string, expectedVersion: number, reason: string, requestId: string) => request(`${path(key)}/publish`, parseConfig, { expectedVersion, reason, requestId });
export const rollbackConfig = (key: string, version: number, expectedVersion: number, reason: string, requestId: string) => request(`${path(key)}/rollback`, parseConfig, { version, expectedVersion, reason, requestId });
