import {t,useLanguageStore} from '../../i18n';
import {getLanguage} from '../../i18n/config';
import {Icon} from '../../components/Icon';
import {useLobbyContent} from './useLobbyContent';
export function NoticeBar(){
 const locale=useLanguageStore(s=>s.locale);const query=useLobbyContent();const items=query.data.announcements[locale]??query.data.announcements['en-US'];
 const defaults=(['zh-TW','en-US'] as const).map(code=>getLanguage(code).messages['copy.welcomeToAislotsEnjoyYourGames']);
 const notice=items.map(text=>defaults.includes(text)?t('copy.welcomeToAislotsEnjoyYourGames'):text).join('　 ');
 return <section className="home-notice" aria-label={t('copy.notices')}><Icon name="speaker" size={16}/><div className="notice-viewport"><div className="notice-track"><span>{notice}</span><span aria-hidden="true">{notice}</span></div></div>{query.isError&&<button type="button" className="notice-retry" aria-label={t('copy.retry')} disabled={query.isFetching} onClick={()=>void query.refetch()}><Icon name="refresh" size={14}/></button>}</section>;
}
