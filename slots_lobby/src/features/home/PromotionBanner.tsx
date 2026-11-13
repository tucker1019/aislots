import {Carousel} from 'antd';
import {t,useLanguageStore} from '../../i18n';
import type {Locale} from '../../i18n';
import {getLanguage} from '../../i18n/config';
import {navigateLobby} from '../../app/useLobbyRoute';
import {useLobbyContent} from './useLobbyContent';
import type {ContentBanner,ContentRoute} from '../../services/lobby-content';
const labels={referral:'promotion.referral',deposit:'promotion.deposit',cashback:'promotion.cashback'} as const;
const routes={'/':'home','/earn':'earn','/deposit':'deposit','/offers':'offers'} as const satisfies Record<ContentRoute,string>;
function bannerAlt(banner:ContentBanner,locale:Locale){
 const key=labels[banner.id as keyof typeof labels];
 if(locale==='id-ID'&&key&&banner.altEnUs===getLanguage('en-US').messages[key])return t(key);
 return locale==='zh-TW'?banner.altZhTw:banner.altEnUs;
}
export function PromotionBanner(){
 const locale=useLanguageStore(s=>s.locale);const {data}=useLobbyContent();const banners=data.banners.filter(b=>b.enabled);
 if(!banners.length)return null;
 return <section className="promotion-banner" aria-label={t('copy.carousel')}><Carousel autoplay={{dotDuration:true}} autoplaySpeed={4000} swipeToSlide draggable>{banners.map(b=><div key={b.id}><button className="promotion-link" onClick={()=>navigateLobby(routes[b.route])}><img src={locale==='zh-TW'?b.imageZhTw:b.imageEnUs} alt={bannerAlt(b,locale)}/></button></div>)}</Carousel></section>;
}
