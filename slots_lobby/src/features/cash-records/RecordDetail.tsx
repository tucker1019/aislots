import { t, getLocale } from '../../i18n';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRechargeOrder } from '../../services/recharge';
import { useAccountProfile } from '../account/useAccountProfile';
import { coinsLabel } from '../account/formatCoins';
import { RecordsLayout } from '../../components/records/RecordsLayout';
export function RecordDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const profile = useAccountProfile();
  const order = useQuery({ queryKey: ['recharge-order', profile.data?.uid, orderId], enabled: !!profile.data,
    queryFn: ({ signal }) => fetchRechargeOrder(orderId, signal), retry: false,
    refetchInterval: query => query.state.data?.status === 'pending' ? 3000 : false });
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const data = order.data;
  const client = useQueryClient();
  useEffect(() => { if (data?.status === 'success') void client.invalidateQueries({ queryKey: ['lobby', 'current-profile'] }); }, [data?.status, client]);
  async function copy() {
    if (copying || !data) return;
    setCopying(true); setCopyError('');
    try { await navigator.clipboard.writeText(data.orderId); setCopied(true); }
    catch { setCopyError(t('copy.copyFailedPressAndHoldTheOrder')); }
    finally { setCopying(false); }
  }
  const failed = profile.isError || order.isError;
  return <RecordsLayout title={t('copy.depositDetails')} backLabel={t('copy.backToDepositHistory')} onBack={onBack}>
    {failed ? <section className="cash-records-feedback" role="alert"><p>{t('copy.depositDetailsFailedToLoadPleaseRetry')}</p><button type="button" disabled={profile.isFetching || order.isFetching}
      onClick={() => { if (profile.isError) void profile.refetch(); else void order.refetch(); }}>{t('copy.reload')}</button></section>
      : !data ? <p className="cash-records-feedback" role="status">{t('copy.loadingDepositDetails')}</p>
      : <article className="cash-receipt">
        <div className="cash-receipt-summary"><span>{t('copy.depositAmount')}</span><strong>+{coinsLabel(data.amount)}</strong>
          <p className={`cash-status-${data.status}`}>{data.status === 'success' ? t('copy.transactionSuccessful') : data.status === 'failed' ? t('copy.transactionFailed') : t('copy.awaitingPaymentConfirmation')}</p></div>
        <dl>
          <div><dt>{t('copy.paymentMethod')}</dt><dd>{t('copy.testPayment')}</dd></div>
          <div><dt>{t('copy.fee')}</dt><dd>{coinsLabel(data.fee)}</dd></div>
          {data.bonus > 0 && <div><dt>{t('copy.bonusAmount')}</dt><dd>{coinsLabel(data.bonus)}</dd></div>}
          <div><dt>{data.status === 'pending' ? t('copy.expectedCredit') : t('copy.amountCredited')}</dt><dd className="cash-receipt-credit">{coinsLabel(data.status === 'failed' ? 0 : data.creditAmount)}</dd></div>
          <div><dt>{t('copy.transactionTime')}</dt><dd>{new Date(data.createdAt).toLocaleString(getLocale(), { hour12: false })}</dd></div>
          <div className="cash-receipt-order"><dt>{t('copy.orderNumber')}</dt><dd><span>{data.orderId}</span><button type="button" disabled={copying} onClick={() => { void copy(); }}>{copied ? t('copy.copied') : t('copy.copy')}</button></dd></div>
          <div><dt>{t('copy.notes')}</dt><dd>—</dd></div>
        </dl>
        {copyError && <p role="status" className="cash-copy-error">{copyError}</p>}
      </article>}
  </RecordsLayout>;
}
