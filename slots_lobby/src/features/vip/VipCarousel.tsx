import { t } from '../../i18n';
import { useEffect, useRef } from 'react';
import type { VipLevel } from '../../services/vip-details';
import { betMoney } from '../bet-records/money';
interface Props { levels: VipLevel[]; selected: number; current: number; highest: number; onSelect: (level: number) => void }
export function VipCarousel({ levels, selected, current, highest, onSelect }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const center = () => {
      const card = element.querySelector<HTMLElement>(`[data-level="${selected}"]`);
      if (card) element.scrollLeft = card.offsetLeft - (element.clientWidth - card.offsetWidth) / 2;
    };
    // Recenter after layout changes, without moving the page vertically.
    center();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(center);
    observer?.observe(element);
    window.addEventListener('resize', center);
    return () => { observer?.disconnect(); window.removeEventListener('resize', center); };
  }, [selected]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const center = element.scrollLeft + element.clientWidth / 2;
        const cards = Array.from(element.querySelectorAll<HTMLElement>('[data-level]'));
        const closest = cards.reduce<HTMLElement | undefined>((best, card) => !best || Math.abs(card.offsetLeft + card.offsetWidth / 2 - center) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - center) ? card : best, undefined);
        if (closest) onSelect(Number(closest.dataset.level));
      }, 140);
    };
    element.addEventListener('scroll', settle, { passive: true });
    return () => { clearTimeout(timer); element.removeEventListener('scroll', settle); };
  }, [onSelect]);
  return <div ref={viewport} className="vip-carousel" role="region" aria-roledescription={t('copy.carousel')} aria-label={t('copy.vipLevelCards')} tabIndex={0} onKeyDown={event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = levels.findIndex(row => row.level === selected);
    onSelect(levels[Math.max(0, Math.min(levels.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))].level);
  }}>{levels.map(tier => <section key={tier.level} data-level={tier.level} className={`vip-tier-card${tier.level === selected ? ' vip-tier-selected' : ''}`} role="group" aria-label={t('copy.vipValueBenefits', {p0: tier.level})} aria-hidden={tier.level !== selected}>
    <span>{tier.level === current ? t('copy.currentLevel') : tier.level <= highest ? t('copy.unlocked') : t('copy.locked')}</span><h2>VIP{tier.level}</h2><p>{t('copy.upgradeDeposits')} {betMoney(tier.upgradeRecharge)} {t('copy.eligibleTurnover207')} {betMoney(tier.upgradeBet)}</p><p>{t('copy.protectionDeposits')} {betMoney(tier.keepRecharge)} {t('copy.eligibleTurnover207')} {betMoney(tier.keepBet)}</p>
  </section>)}</div>;
}
