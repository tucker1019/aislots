import { mahjongGame } from './content';

export function GameTile({ loading, onEnter }: { loading: boolean; onEnter: () => void }) {
  return <button type="button" className="game-tile" aria-label={loading ? '正在进入麻将胡了' : '进入麻将胡了'}
    disabled={loading} aria-busy={loading} onClick={onEnter}>
    <img src={mahjongGame.cover} alt="" width={756} height={2000} />
    <span className="game-provider" aria-hidden="true">AG</span>
    <span className="game-name">{loading ? '正在进入…' : mahjongGame.title}</span>
  </button>;
}
