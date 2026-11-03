import { t } from '../../i18n';
export function PromotionBanner() {
  return <section className="promotion-banner" aria-label={t('copy.featuredGame')}>
    <img src="/assets/lobby/mahjong-banner.jpg" alt="" />
    <div className="promotion-copy">
      <span>MAHJONG WAYS</span>
      <h1>{t('copy.mahjongWays')}</h1>
      <p>{t('copy.classicTilesCascadingWins')}</p>
    </div>
  </section>;
}
