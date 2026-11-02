import { GameArt } from './GameArt';
import { GameLaunchButton } from './GameLaunchButton';
import { FavoriteButton } from '../favorites/FavoriteButton';
import type { Game } from './types';
export function GameCard({ game }: { game: Game }) {
  return <article className="game-card" aria-label={game.title}>
    <div className={`game-cover cover-${game.art}`}>
      <GameArt art={game.art} />
      <div className="game-badges">
        {game.status === 'upcoming' ? <span className="game-badge">筹备中</span>
          : game.featured && <span className="game-badge badge-featured">精选</span>}
        {game.isNew && <span className="game-badge badge-new">新作预告</span>}
      </div>
      <FavoriteButton id={game.id} title={game.title} />
    </div>
    <div className="game-card-body">
      <div className="game-title-row"><h3>{game.title}</h3><GameLaunchButton game={game} /></div>
      <div className="game-subtitle">{game.subtitle}</div>
      <div className="game-meta"><span>{game.category === 'cascade' ? '连续消除' : '连线玩法'}</span>
        <span className="meta-divider" />{game.status === 'available' ? 'AISlots' : '即将到来'}</div>
    </div>
  </article>;
}
