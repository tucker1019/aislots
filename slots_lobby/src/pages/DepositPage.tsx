import { UserSummary } from '../features/account/UserSummary';
import { RecordsLayout } from '../components/records/RecordsLayout';
import {LoadingState} from '../components/feedback/LoadingState';
import {NetworkError} from '../components/feedback/NetworkError';
import { t } from '../i18n';
import { useQuery } from '@tanstack/react-query';
import { useAccountProfile } from '../features/account/useAccountProfile';
import { fetchRechargeTiers } from '../services/recharge';
import { DepositForm } from '../features/deposit/DepositForm';
export function DepositPage() {
 const profile=useAccountProfile();
 const tiers=useQuery({queryKey:['recharge-tiers',profile.data?.uid],enabled:!!profile.data,queryFn:({signal})=>fetchRechargeTiers(signal),retry:false});
 return <RecordsLayout className="deposit-page" title={t('copy.deposit')} actions={<div className="payment-wallet-bar"><UserSummary showAvatar={false} showDeposit={false}/></div>}>
  <p className="deposit-test-notice">{t('copy.thisIsATestPaymentChannelOrders')}</p>
  {profile.isPending||(!profile.isError&&tiers.isPending)?<LoadingState label={t('copy.loadingDepositOptions')}/>:profile.isError||tiers.isError?<NetworkError disabled={profile.isFetching||tiers.isFetching} onRetry={()=>{if(profile.isError)void profile.refetch();else void tiers.refetch();}}/>:!tiers.data?.length?<section className="deposit-card"><h2>{t('copy.noDepositOptionsAvailable')}</h2><p>{t('copy.pleaseCheckAgainLater')}</p></section>:profile.data&&<DepositForm key={profile.data.uid} uid={profile.data.uid} tiers={tiers.data} />}
 </RecordsLayout>;
}
