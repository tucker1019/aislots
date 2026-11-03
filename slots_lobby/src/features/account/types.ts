export interface Session { uid: number; sid: string; expiresAt: string }
export interface UserProfile { uid: number; nickname: string; avatarId: number; coins: number }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
/** 同时校验网络响应和本机保存的身份；过期身份保留，用于提示恢复失败。 */
export function isSession(value: unknown): value is Session {
  return isRecord(value) && Number.isSafeInteger(value.uid) && Number(value.uid) > 0 &&
    typeof value.sid === 'string' && /^[A-Za-z0-9]{52}$/.test(value.sid) &&
    typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt));
}
