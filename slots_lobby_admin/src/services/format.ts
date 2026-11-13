export function money(value: string): string {
 const negative = value.startsWith('-'); const digits = value.replace(/^-/, '').padStart(3, '0');
 const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 return `${negative ? '-' : ''}${whole}.${digits.slice(-2)}`;
}
export function date(value: string): string {
 if (!value) return '—'; const time = new Date(value);
 return Number.isNaN(time.getTime()) ? value : time.toLocaleString('zh-CN', { hour12: false });
}
export const roleLabels = { admin: '管理员', operator: '运营', finance: '财务', viewer: '只读' };
export const statusLabels: Record<string, string> = { success: '已完成', failed: '已关闭 / 退回', pending: '待处理', pending_payment: '待付款', pending_review: '待审核', approved: '审核通过', paid: '已支付', completed: '已完成', settled: '已结算', returned: '已退回', closed: '已关闭', rejected: '已拒绝' };

/** Ratio of integer minor-unit amounts, rounded to two percent decimals without float conversion. */
export function rtp(bet: string, win: string): string {
 const stake = BigInt(bet);
 if (stake <= 0n) return '—';
 const hundredths = (BigInt(win) * 10000n + stake / 2n) / stake;
 return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}%`;
}
