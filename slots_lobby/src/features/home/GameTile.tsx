import { useState } from 'react';
import { rememberGameCardOrigin } from '../game/gameCardOrigin';
import { coverPresentation } from './coverPresentation';
export function GameTile({ cover, label, onEnter, lazy, gameId, provider, title }: { cover: string; label: string; onEnter: () => void; lazy?: boolean; gameId?: string; provider?: string; title?: string }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const artwork = coverPresentation(gameId, cover);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const redesigned = artwork.redesigned && failedSource !== artwork.src;
  return <button type="button" className={`game-tile${redesigned ? ' game-tile--redesigned' : ''}${imageLoaded ? ' is-image-loaded' : ''}`} aria-busy={!imageLoaded} aria-label={label} data-game-id={gameId} onClick={event=>{if(gameId)rememberGameCardOrigin(gameId,event.currentTarget);onEnter();}}>
    <img key={artwork.src} src={redesigned ? artwork.src : cover} alt="" width={218} height={284} loading={lazy ? 'lazy' : undefined} onLoad={() => setImageLoaded(true)} onError={() => { if (redesigned) { setFailedSource(artwork.src); setImageLoaded(false); } else setImageLoaded(true); }} />
    {redesigned && <span className="game-tile-caption" aria-hidden="true"><strong>{title ?? label}</strong>{provider && <small>{provider}</small>}</span>}
  </button>;
}
