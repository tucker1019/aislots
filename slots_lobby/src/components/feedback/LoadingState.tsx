import {Spin} from 'antd';
import {t} from '../../i18n';
import './loading-state.css';
interface Props {label?:string;compact?:boolean}
/** Loading stays inside its owning content area; cards and dialogs use compact spacing. */
export function LoadingState({label,compact=false}:Props){
 return <section className={`loading-state${compact?' loading-state-compact':''}`} role="status"><Spin/><span>{label??t('copy.loading')}</span></section>;
}
