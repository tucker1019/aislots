import { t } from '../../i18n';
import { mahjongGame } from './content';

export function GameTile({ loading, onEnter }: { loading: boolean; onEnter: () => void }) {
  return <button type="button" className="game-tile" aria-label={loading ? t('copy.openingMahjongWays') : t('copy.enterMahjongWays')}
    disabled={loading} aria-busy={loading} onClick={onEnter}>
    <img src={mahjongGame().cover} alt="" width={756} height={2000} />
    <span className="game-provider" aria-hidden="true">AG</span>
    <span className="game-name">{loading ? t('copy.opening') : mahjongGame().title}</span>
  </button>;
}
