import {t} from '../../i18n';
import './claim-badge.css';
export function ClaimBadge({active}:{active:boolean}){
 return active?<span className="claim-badge" aria-hidden="true" title={t('claim.available')}>{t('claim.badge')}</span>:null;
}
