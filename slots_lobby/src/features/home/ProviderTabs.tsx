import { FavoriteStar } from '../../components/FavoriteStar';
import { t } from '../../i18n';
import type { AvailableProvider } from './content';

interface ProviderTabsProps {
  selected: AvailableProvider;
  providers?: readonly string[];
  onSelect: (provider: AvailableProvider) => void;
}
export function ProviderTabs({ selected, providers: dynamicProviders = ['AG'], onSelect }: ProviderTabsProps) {
  const tabs = [
    { id: 'hot', label: t('copy.hot'), mark: '🔥' },
    { id: 'favorites', label: t('favorites.title'), mark: <FavoriteStar/> },
    ...dynamicProviders.map(name => ({ id: name, label: name, mark: null })),
  ];
  return <nav className="provider-tabs" aria-label={t('copy.gameProviders')}>
    {tabs.map(provider => <button type="button" key={provider.id} aria-pressed={provider.id === selected}
      className={`provider-tab provider-${provider.id}`} onClick={() => onSelect(provider.id)}>
      {provider.mark && <span className="provider-mark" aria-hidden="true">{provider.mark}</span>}
      <span>{provider.label}</span>
    </button>)}
  </nav>;
}
