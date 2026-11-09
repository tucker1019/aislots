export function GameTile({ cover, label, onEnter, lazy }: { cover: string; label: string; onEnter: () => void; lazy?: boolean }) {
  return <button type="button" className="game-tile" aria-label={label} onClick={onEnter}>
    <img src={cover} alt="" width={218} height={284} loading={lazy ? 'lazy' : undefined} />
  </button>;
}
