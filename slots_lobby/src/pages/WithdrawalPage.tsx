import {useQuery} from '@tanstack/react-query';
import {NetworkError} from '../components/feedback/NetworkError';
import {RecordsLayout} from '../components/records/RecordsLayout';
import {useAccountProfile} from '../features/account/useAccountProfile';
import {loadWithdrawalTiers} from '../services/withdrawal';
import {WithdrawalForm} from '../features/withdrawal/WithdrawalForm';
import {WithdrawalReceipt} from '../features/withdrawal/WithdrawalReceipt';
import {t} from '../i18n';
export function WithdrawalPage({onBack,orderId}:{onBack:()=>void;orderId?:string}){
 const profile=useAccountProfile();const tiers=useQuery({queryKey:['withdrawal-tiers',profile.data?.uid],enabled:!!profile.data&&!orderId,queryFn:({signal})=>loadWithdrawalTiers(signal),retry:false});
 return <RecordsLayout title={t(orderId?'withdrawal.details':'copy.withdraw')} backLabel={t('copy.backToMyAccount')} onBack={onBack} className="withdrawal-page">{orderId?<WithdrawalReceipt orderId={orderId}/>:profile.isError||tiers.isError?<NetworkError disabled={profile.isFetching||tiers.isFetching} onRetry={()=>{if(profile.isError)void profile.refetch();else void tiers.refetch();}}/>:!profile.data||tiers.isPending?<p role="status">{t('copy.loading')}</p>:<WithdrawalForm key={profile.data.uid} uid={profile.data.uid} coins={profile.data.coins} tiers={tiers.data?.items||[]}/>}</RecordsLayout>;
}
