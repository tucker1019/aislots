import { rememberGameCardOrigin } from '../game/gameCardOrigin';
export function GameTile({ cover, label, onEnter, lazy, gameId }: { cover: string; label: string; onEnter: () => void; lazy?: boolean; gameId?: string }) {
  return <button type="button" className="game-tile" aria-label={label} data-game-id={gameId} onClick={event=>{if(gameId)rememberGameCardOrigin(gameId,event.currentTarget);onEnter();}}>
    <img src={cover} alt="" width={218} height={284} loading={lazy ? 'lazy' : undefined} />
  </button>;
}
