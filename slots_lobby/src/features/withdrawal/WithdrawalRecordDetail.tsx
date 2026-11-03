import {RecordsLayout} from '../../components/records/RecordsLayout';
import {WithdrawalReceipt} from './WithdrawalReceipt';
import {t} from '../../i18n';
export function WithdrawalRecordDetail({orderId,onBack}:{orderId:string;onBack:()=>void}){return <RecordsLayout title={t('withdrawal.details')} backLabel={t('wallet.back')} onBack={onBack}><WithdrawalReceipt orderId={orderId}/></RecordsLayout>;}
