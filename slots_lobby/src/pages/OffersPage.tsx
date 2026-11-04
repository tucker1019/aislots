import { useState } from 'react';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { t, useLanguageStore } from '../i18n';
import { offerCategories, offerPosters, type OfferCategory } from '../features/offers/posters';

export function OffersPage() {
 const [category,setCategory]=useState<OfferCategory>('all');
 const locale=useLanguageStore(state=>state.locale);
 const posters=offerPosters.filter(poster=>category==='all'||poster.category===category);
 return <RecordsLayout title={t('copy.offers')} className="offers-page">
  <div className="offers-layout">
   <nav className="offers-categories" aria-label={t('offers.categories')}>
    {offerCategories.map(item=><button key={item} type="button" aria-pressed={category===item} onClick={()=>setCategory(item)}>{t(`offers.${item}`)}</button>)}
   </nav>
   <section className="offers-posters" aria-label={t('copy.offers')}>
    {posters.map((poster,index)=><img key={`${poster.id}-${locale}`} src={`/assets/lobby/offers/${poster.id}-${locale==='en-US'?'en':'zh'}.webp`} alt={t(poster.label)} width={960} height={320} loading={index<2?'eager':'lazy'} decoding="async"/>)}
   </section>
  </div>
 </RecordsLayout>;
}
