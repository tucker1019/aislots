import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { t } from '../i18n';
import { useSessionStore } from '../stores/session';

export type MailRewardType = 'rebate_daily' | 'rebate_weekly' | 'rebate_monthly' | 'loss_return' | 'leaderboard';
export type MailNoticeType = 'settlement' | 'reminder' | 'expired';
export interface MailItem {
  mailId: number;
  rewardType: MailRewardType;
  noticeType: MailNoticeType;
  reminderHours: number;
  businessDate: string;
  deadline: string;
  actionPath: '/earn' | '/platform-leaderboard';
  sentAt: string;
  unread: boolean;
}
export interface MailPage { items: MailItem[]; nextCursor: string; hasMore: boolean }

function validMail(value: unknown): MailItem {
  if (!isRecord(value) || !Number.isSafeInteger(value.mailId) || Number(value.mailId) <= 0 ||
    typeof value.rewardType !== 'string' || !['rebate_daily','rebate_weekly','rebate_monthly','loss_return','leaderboard'].includes(value.rewardType) ||
    typeof value.noticeType !== 'string' || !['settlement','reminder','expired'].includes(value.noticeType) ||
    !Number.isInteger(value.reminderHours) || Number(value.reminderHours) < 0 ||
    typeof value.businessDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.businessDate) ||
    typeof value.deadline !== 'string' || !Number.isFinite(Date.parse(value.deadline)) ||
    typeof value.actionPath !== 'string' || !['/earn','/platform-leaderboard'].includes(value.actionPath) ||
    typeof value.sentAt !== 'string' || !Number.isFinite(Date.parse(value.sentAt)) || typeof value.unread !== 'boolean') {
    throw new Error(t('mail.invalidResponse'));
  }
  return {
    mailId: Number(value.mailId),
    rewardType: value.rewardType as MailRewardType,
    noticeType: value.noticeType as MailNoticeType,
    reminderHours: Number(value.reminderHours),
    businessDate: value.businessDate,
    deadline: value.deadline,
    actionPath: value.actionPath as MailItem['actionPath'],
    sentAt: value.sentAt,
    unread: value.unread,
  };
}

function requireSameSession(uid: number, sid: string) {
  const current = useSessionStore.getState().session;
  if (current?.uid !== uid || current.sid !== sid) throw new Error(t('copy.signInStateChangedPleaseRetry'));
}

export async function loadMail(cursor: string, signal: AbortSignal, expectedUid?: number): Promise<MailPage> {
  const session = await ensureSession();
  if (expectedUid !== undefined && session.uid !== expectedUid) throw new Error(t('copy.accountChangedPleaseTryAgain'));
  const params = new URLSearchParams({ uid: String(session.uid), sid: session.sid, limit: '40' });
  if (cursor) params.set('cursor', cursor);
  const data = await request('/api/mail/list?' + params, { signal }, t('mail.loadFailed'));
  requireSameSession(session.uid, session.sid);
  if (!isRecord(data) || !Array.isArray(data.items) || typeof data.nextCursor !== 'string' || typeof data.hasMore !== 'boolean') throw new Error(t('mail.invalidResponse'));
  return { items: data.items.map(validMail), nextCursor: data.nextCursor, hasMore: data.hasMore };
}

async function mutateMail(path: string, mailId?: number, expectedUid?: number) {
  const session = await ensureSession();
  if (expectedUid !== undefined && session.uid !== expectedUid) throw new Error(t('copy.accountChangedPleaseTryAgain'));
  const data = await request(path, { method: 'POST', body: JSON.stringify({ uid: session.uid, sid: session.sid, ...(mailId === undefined ? {} : { mailId }) }) }, t('mail.actionFailed'));
  requireSameSession(session.uid, session.sid);
  if (!isRecord(data) || data.success !== true) throw new Error(t('mail.actionFailed'));
}

export const markMailRead = (mailId: number, expectedUid?: number) => mutateMail('/api/mail/read', mailId, expectedUid);
export const markAllMailRead = (expectedUid?: number) => mutateMail('/api/mail/read-all', undefined, expectedUid);
export const deleteMail = (mailId: number, expectedUid?: number) => mutateMail('/api/mail/delete', mailId, expectedUid);
