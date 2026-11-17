import { gameDisplay, type GameId } from '../../app/games';
import { t } from '../../i18n';
import { useLobbyGames } from '../home/useLobbyGames';

export function MinimizedGameBar({ gameId, onRestore, onClose }: { gameId: GameId; onRestore: () => void; onClose: () => void }) {
  const catalog = useLobbyGames();
  const game = gameDisplay(gameId, catalog.data?.find(entry => entry.id === gameId));
  return <aside className="minimized-game-bar"><button type="button" className="minimized-game-restore" aria-label={`${t('gamePreview.resume')} · ${game.title}`} onClick={onRestore}>
    <span className="minimized-game-cover"><img src={game.cover} alt="" /><span className="minimized-game-play" aria-hidden="true">▶</span></span>
    <span className="minimized-game-copy"><strong>{game.title}</strong></span>
    <span className="minimized-game-resume">{t('gamePreview.resume')} <span aria-hidden="true">⌃</span></span>
  </button><button type="button" className="minimized-game-close" onClick={onClose} aria-label={t('gamePreview.closeMinimized')}>×</button></aside>;
}
