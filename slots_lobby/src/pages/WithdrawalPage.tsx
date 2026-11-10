import { UserSummary } from '../features/account/UserSummary';
import {LoadingState} from '../components/feedback/LoadingState';
import {useQuery} from '@tanstack/react-query';
import type {ReactNode} from 'react';
import {NetworkError} from '../components/feedback/NetworkError';
import {RecordsLayout} from '../components/records/RecordsLayout';
import {useAccountProfile} from '../features/account/useAccountProfile';
import {loadWithdrawalTiers} from '../services/withdrawal';
import {WithdrawalForm} from '../features/withdrawal/WithdrawalForm';
import {WithdrawalReceipt} from '../features/withdrawal/WithdrawalReceipt';
import {t} from '../i18n';

export function WithdrawalPage({onBack,orderId}:{onBack:()=>void;orderId?:string}) {
 const profile=useAccountProfile();
 const enabled=!!profile.data&&!orderId;
 const tiers=useQuery({queryKey:['withdrawal-tiers',profile.data?.uid],enabled,queryFn:({signal})=>loadWithdrawalTiers(signal),retry:false});
 const failed=profile.isError||tiers.isError;
 const retry=()=>{if(profile.isError)void profile.refetch();if(tiers.isError)void tiers.refetch();};
 const error=<NetworkError disabled={profile.isFetching||tiers.isFetching} onRetry={retry}/>;
 let content:ReactNode;
 if(orderId)content=<WithdrawalReceipt orderId={orderId}/>;
 else if((profile.isError&&!profile.data)||(tiers.isError&&!tiers.data))content=error;
 else if(!profile.data||!tiers.data)content=<LoadingState/>;
 else content=<>{failed&&error}<WithdrawalForm key={profile.data.uid} uid={profile.data.uid} coins={profile.data.coins} tiers={tiers.data.items} submissionUnavailable={failed}/></>;
 return <RecordsLayout title={t(orderId?'withdrawal.details':'copy.withdraw')} backLabel={t('copy.backToMyAccount')} onBack={onBack} className="withdrawal-page" actions={<div className="payment-wallet-bar"><UserSummary showAvatar={false}/></div>}>{content}</RecordsLayout>;
}
