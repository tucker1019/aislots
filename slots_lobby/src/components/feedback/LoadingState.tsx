import {t} from '../../i18n';
import {SlotsLoader} from './SlotsLoader';
import './loading-state.css';
interface Props {label?:string;compact?:boolean}
/** Loading stays inside its owning content area; cards and dialogs use compact spacing. */
export function LoadingState({compact=false}:Props){
 return <section className={`loading-state${compact?' loading-state-compact':''}`} role="status"><SlotsLoader/><span>{t('copy.loading')}</span></section>;
}
