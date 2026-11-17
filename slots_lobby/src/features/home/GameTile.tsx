import { useState } from 'react';
import { rememberGameCardOrigin } from '../game/gameCardOrigin';
export function GameTile({ cover, label, onEnter, lazy, gameId }: { cover: string; label: string; onEnter: () => void; lazy?: boolean; gameId?: string }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  return <button type="button" className={`game-tile${imageLoaded ? ' is-image-loaded' : ''}`} aria-busy={!imageLoaded} aria-label={label} data-game-id={gameId} onClick={event=>{if(gameId)rememberGameCardOrigin(gameId,event.currentTarget);onEnter();}}>
    <img src={cover} alt="" width={218} height={284} loading={lazy ? 'lazy' : undefined} onLoad={() => setImageLoaded(true)} onError={() => setImageLoaded(true)} />
  </button>;
}
