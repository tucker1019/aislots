import { object, string } from './schema';

export async function issuePreviewTicket(uid: number, sid: string): Promise<string> {
 const response = await fetch('/api/game/launch', {
  method: 'POST',
  credentials: 'omit',
  redirect: 'error',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid, sid, gameId: 'AG1' }),
 });
 const payload = object(await response.json().catch(() => null));
 if (!response.ok || payload.code !== 'OK') {
  throw new Error('签发失败，请确认 UID 和 SID 属于当前环境且会话仍然有效。');
 }
 const launch = object(payload.data);
 const ticket = new URL(string(launch.launchUrl), window.location.origin).searchParams.get('launchTicket');
 if (ticket?.length !== 52 || !(Date.parse(string(launch.expiresAt)) > Date.now())) {
  throw new Error('服务返回的启动票据无效或已过期。');
 }
 return ticket;
}
