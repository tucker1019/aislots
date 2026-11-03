import {Button} from 'antd';
import {t} from '../../i18n';
import './network-error.css';
interface Props {onRetry:()=>void;disabled?:boolean}
/** Shared error state for a failed data load; never submits a business action. */
export function NetworkError({onRetry,disabled=false}:Props){
 return <section className="network-error" role="alert"><p>{t('feedback.networkError')}</p><Button autoInsertSpace={false} type="primary" loading={disabled} disabled={disabled} onClick={onRetry}>{t('copy.retry')}</Button></section>;
}
