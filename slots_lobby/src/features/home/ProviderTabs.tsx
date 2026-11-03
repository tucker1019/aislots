import type { AvailableProvider } from './content';

const providers = [
  { id: 'hot', label: '热门', mark: '🔥' },
  { id: 'AG', label: 'AG', mark: 'AG' },
  { id: 'PG', label: 'PG', mark: 'PG' },
  { id: 'JILI', label: 'JILI', mark: 'JILI' },
  { id: 'PP', label: 'PP', mark: 'PP' },
] as const;
interface ProviderTabsProps {
  selected: AvailableProvider;
  onSelect: (provider: AvailableProvider) => void;
  onComingSoon: () => void;
}
export function ProviderTabs({ selected, onSelect, onComingSoon }: ProviderTabsProps) {
  return <nav className="provider-tabs" aria-label="游戏厂商">
    {providers.map(provider => <button type="button" key={provider.id} aria-pressed={provider.id === selected}
      className={`provider-tab provider-${provider.id}`} onClick={() => {
        if (provider.id === 'hot' || provider.id === 'AG') onSelect(provider.id);
        else onComingSoon();
      }}>
      <span className="provider-mark" aria-hidden="true">{provider.mark}</span>
      <span>{provider.label}</span>
    </button>)}
  </nav>;
}
