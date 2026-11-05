import { Carousel } from 'antd';
import { t, useLanguageStore } from '../../i18n';
import { navigateLobby } from '../../app/useLobbyRoute';

const banners = [
  { src: 'referral-200-zh-tw-v1.webp', enSrc: 'referral-200-en-v1.webp', label: 'promotion.referral', route: 'earn' },
  { src: 'deposit-bonus-5-zh-tw-v1.webp', enSrc: 'deposit-bonus-5-en-v1.webp', label: 'promotion.deposit', route: 'deposit' },
  { src: 'cashback-1-zh-tw-v1.webp', enSrc: 'cashback-1-en-v1.webp', label: 'promotion.cashback', route: 'earn' },
] as const;

export function PromotionBanner() {
  const locale = useLanguageStore(state => state.locale);
  return <section className="promotion-banner" aria-label={t('copy.carousel')}>
    <Carousel autoplay={{ dotDuration: true }} autoplaySpeed={4000} swipeToSlide draggable>
      {banners.map(banner => <div key={banner.src}>
        <button className="promotion-link" onClick={() => navigateLobby(banner.route)}>
          <img src={`/assets/lobby/promotions/${locale === 'en-US' ? banner.enSrc : banner.src}`} alt={t(banner.label)} />
        </button>
      </div>)}
    </Carousel>
  </section>;
}
