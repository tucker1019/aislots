import type { Json } from '../services/schema';
export const internalRoutes = ['/', '/earn', '/deposit', '/offers'];
export const gameTemplate: Json = { enabled: false, visible: true, sort: 0, cover: '', name: '', nameEn: '', provider: '', url: '', apiUrl: '' };
const vipTemplate: Json = Object.fromEntries(['level', 'upgradeBet', 'upgradeRecharge', 'keepBet', 'keepRecharge', 'upgradeReward', 'weeklyReward', 'monthlyReward', 'birthdayReward', 'weeklyBet', 'weeklyRecharge', 'monthlyBet', 'monthlyRecharge'].map(key => [key, 0]));
const templates: Record<string, Json> = {
 recharge: { id: '', amount: 0, bonus: 0, fee: 0 },
 withdrawal: { id: '', amount: 0, bonus: 0, fee: 0 },
 'checkin.days': { requiredRecharge: 0, requiredBet: 0, reward: 0 },
 'vip.levels': vipTemplate,
 'newbie-recharge.tiers': { id: '', requiredRecharge: 0, reward: 0 },
 'content.announcements.zh-TW': '',
 'content.announcements.en-US': '',
 'content.banners': { id: '', enabled: false, imageZhTw: '', imageEnUs: '', altZhTw: '', altEnUs: '', route: '/' },
};
export function arrayTemplate(path: string): Json | undefined {
 if (/^agent\.providers\.[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(path)) return { threshold: 0, rate: 0 };
 return templates[path];
}
export function mapTemplate(path: string): Json | undefined {
 if (path === 'games.games') return gameTemplate;
 if (path === 'agent.providers') return [];
 return undefined;
}
export function validMapKey(key: string, value: Record<string, Json>): boolean {
 return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key) && !Object.hasOwn(value, key);
}

export function validImagePath(value: string): boolean {
 if (/^\/assets\/[^\s\\?#]+$/.test(value)) return !value.split('/').includes('..');
 try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
