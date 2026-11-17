import type { RefObject } from 'react';
import { gameDisplay, type GameId } from '../../app/games';
import { t } from '../../i18n';
import { useLobbyGames } from '../home/useLobbyGames';

export function MinimizedGameBar({ gameId, onRestore, onClose, targetRef, visible = true }: { gameId: GameId; onRestore: () => void; onClose: () => void; targetRef?: RefObject<HTMLElement | null>; visible?: boolean }) {
  const catalog = useLobbyGames();
  const game = gameDisplay(gameId, catalog.data?.find(entry => entry.id === gameId));
  return <aside ref={targetRef} className={`minimized-game-bar${visible ? '' : ' minimized-game-bar-hidden'}`} aria-hidden={!visible} inert={!visible}><button type="button" className="minimized-game-restore" aria-label={`${t('gamePreview.resume')} · ${game.title}`} onClick={onRestore}>
    <span className="minimized-game-cover"><img src={game.cover} alt="" /><span className="minimized-game-play" aria-hidden="true">▶</span></span>
    <span className="minimized-game-copy"><strong>{game.title}</strong></span>
    <span className="minimized-game-resume">{t('gamePreview.resume')} <span aria-hidden="true">⌃</span></span>
  </button><button type="button" className="minimized-game-close" onClick={onClose} aria-label={t('gamePreview.closeMinimized')}>×</button></aside>;
}
