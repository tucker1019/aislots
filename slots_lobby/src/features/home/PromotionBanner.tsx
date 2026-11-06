import {Carousel} from 'antd';
import {t,useLanguageStore} from '../../i18n';
import {navigateLobby} from '../../app/useLobbyRoute';
import {useLobbyContent} from './useLobbyContent';
import type {ContentRoute} from '../../services/lobby-content';
const routes={'/':'home','/earn':'earn','/deposit':'deposit','/offers':'offers'} as const satisfies Record<ContentRoute,string>;
export function PromotionBanner(){
 const locale=useLanguageStore(s=>s.locale);const {data}=useLobbyContent();const banners=data.banners.filter(b=>b.enabled);
 if(!banners.length)return null;
 return <section className="promotion-banner" aria-label={t('copy.carousel')}><Carousel autoplay={{dotDuration:true}} autoplaySpeed={4000} swipeToSlide draggable>{banners.map(b=><div key={b.id}><button className="promotion-link" onClick={()=>navigateLobby(routes[b.route])}><img src={locale==='en-US'?b.imageEnUs:b.imageZhTw} alt={locale==='en-US'?b.altEnUs:b.altZhTw}/></button></div>)}</Carousel></section>;
}
