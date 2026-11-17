import {useState} from 'react';
import {Carousel} from 'antd';
import {t,useLanguageStore} from '../../i18n';
import type {Locale} from '../../i18n';
import {getLanguage} from '../../i18n/config';
import {navigateLobby} from '../../app/useLobbyRoute';
import {useLobbyContent} from './useLobbyContent';
import type {ContentBanner,ContentRoute} from '../../services/lobby-content';
import {defaultPromotions,promotionImage} from './default-promotions';
const routes={'/':'home','/earn':'earn','/deposit':'deposit'} as const satisfies Record<ContentRoute,string>;
function bannerMedia(banner:ContentBanner,locale:Locale){
 if(locale==='zh-TW')return {src:banner.imageZhTw,alt:banner.altZhTw};
 if(locale==='id-ID'){
  // Match the shipped English artwork and caption, not just an operator's ID.
  const original=defaultPromotions.find(item=>item.id===banner.id
   &&promotionImage(item.asset,'en')===banner.imageEnUs
   &&getLanguage('en-US').messages[item.key]===banner.altEnUs);
  if(original)return {src:promotionImage(original.asset,'id-id'),alt:getLanguage(locale).messages[original.key]};
 }
 return {src:banner.imageEnUs,alt:banner.altEnUs};
}
function PromotionBannerItem({banner, locale}:{banner:ContentBanner;locale:Locale}){
 const [imageLoaded,setImageLoaded]=useState(false);
 const media=bannerMedia(banner,locale);
 return <div key={banner.id}><button className={`promotion-link${imageLoaded ? ' is-image-loaded' : ''}`} aria-busy={!imageLoaded} onClick={()=>navigateLobby(routes[banner.route])}><img {...media} width={1080} height={200} onLoad={()=>setImageLoaded(true)} onError={()=>setImageLoaded(true)}/></button></div>;
}
export function PromotionBanner(){
 const locale=useLanguageStore(s=>s.locale);const {data}=useLobbyContent();const banners=data.banners.filter(b=>b.enabled);
 if(!banners.length)return null;
 return <section className="promotion-banner" aria-label={t('copy.carousel')}><Carousel autoplay={{dotDuration:true}} autoplaySpeed={4000} swipeToSlide draggable>{banners.map(b=><PromotionBannerItem key={b.id} banner={b} locale={locale}/>)}</Carousel></section>;
}
