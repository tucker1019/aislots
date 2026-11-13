import { request, params } from './client';
import { object, string, integer, amount, array, optionalString, page } from './schema';
export type Role = 'admin' | 'operator' | 'finance' | 'viewer';
export interface Session { username: string; role: Role }
export function parseSession(value: unknown): Session {
 const data = object(value); const role = string(data.role);
 if (role !== 'admin' && role !== 'operator' && role !== 'finance' && role !== 'viewer') throw new Error('未知的管理员权限');
 return { username: string(data.username), role };
}
export const auth = {
 me: () => request('/me', parseSession),
 login: (values: { username: string; password: string }) => request('/login', parseSession, values),
 logout: () => request('/logout', object, {}),
};
export function parseMember(value: unknown) {
 const d = object(value);
 return { uid: string(d.uid), account: string(d.account), nickname: string(d.nickname), avatarId: integer(d.avatarId), vipLevel: integer(d.vipLevel), coins: amount(d.coins), createdAt: string(d.createdAt), lastLoginAt: optionalString(d.lastLoginAt) };
}
export type Member = ReturnType<typeof parseMember>;
export const getMembers = (q: string, cursor?: string) => request(`/members${params({ q, cursor, limit: 20 })}`, v => page(v, parseMember));
export const getMember = (uid: string) => request(`/members/${encodeURIComponent(uid)}`, value => {
 const d = object(value); const wallet = object(d.wallet);
 return { member: parseMember(d.member), wallet: { coins: amount(wallet.coins), turnoverRequired: amount(wallet.turnoverRequired) },
  accounts: array(d.accounts, v => { const a = object(v); return { channel: string(a.channel), account: string(a.account), name: string(a.name) }; }),
  ledger: array(d.ledger, v => { const l = object(v); return { id: string(l.id), type: string(l.type), amount: amount(l.amount), balance: amount(l.balance), createdAt: string(l.createdAt) }; }) };
});
export type OrderKind = 'deposit' | 'withdrawal';
export function parseOrder(value: unknown) {
 const d = object(value); const kind = string(d.kind);
 if (kind !== 'deposit' && kind !== 'withdrawal') throw new Error('未知订单类型');
 const orderKind: OrderKind = kind;
 return { orderId: string(d.orderId), uid: string(d.uid), kind: orderKind, status: string(d.status), amount: amount(d.amount), fee: amount(d.fee), bonus: amount(d.bonus), creditAmount: amount(d.creditAmount), channel: string(d.channel), account: optionalString(d.account), name: optionalString(d.name), createdAt: string(d.createdAt), settledAt: optionalString(d.settledAt) };
}
export type Order = ReturnType<typeof parseOrder>;
export const getOrders = (kind: OrderKind, status: string, q: string, cursor?: string) => request(`/orders${params({ kind, status, q, cursor, limit: 20 })}`, v => page(v, parseOrder));
export interface Review { kind: OrderKind; orderId: string; decision: 'approve' | 'return'; reason: string; requestId: string }
export const reviewOrder = (review: Review) => request('/orders/review', v => { const d = object(v); return { orderId: string(d.orderId), status: string(d.status) }; }, review);
export const getOverview = () => request('/overview', v => {
 const d = object(v); return { members: integer(d.members), realMembers: integer(d.realMembers), experienceMembers: integer(d.experienceMembers), realBet: amount(d.realBet), realWin: amount(d.realWin), experienceBet: amount(d.experienceBet), experienceWin: amount(d.experienceWin), pendingDeposits: integer(d.pendingDeposits), pendingWithdrawals: integer(d.pendingWithdrawals), todayDeposits: amount(d.todayDeposits), todayWithdrawals: amount(d.todayWithdrawals) };
});
export const getAudit = (q: string, cursor?: string) => request(`/audit${params({ q, cursor, limit: 20 })}`, v => page(v, entry => {
 const d = object(entry); return { id: string(d.id), username: string(d.username), action: string(d.action), target: string(d.target), reason: optionalString(d.reason), createdAt: string(d.createdAt) };
}));
