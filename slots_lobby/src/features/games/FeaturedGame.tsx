import { Button } from 'antd';
import { GameLaunchButton } from './GameLaunchButton';
import { MahjongArt } from './MahjongArt';
import type { Game } from './types';
export function FeaturedGame({ game, onExplore }: { game: Game; onExplore: () => void }) {
  return <section className="featured-section" aria-labelledby="featured-heading">
    <div className="featured-inner">
      <div className="featured-copy">
        <div className="featured-kicker"><span className="featured-dot" />为你精选<span className="featured-game-name">麻将胡了</span></div>
        <h1 id="featured-heading">熟悉的牌面，<br />新的好时光。</h1>
        <p>经典麻将，连消新趣。<br />从这一局，开启属于你的轻松时刻。</p>
        <div className="featured-actions"><GameLaunchButton game={game} hero />
          <Button type="link" onClick={onExplore}>探索全部游戏</Button></div>
        <span className="featured-footnote">Mahjong Ways <span /> 连续消除</span>
      </div>
      <MahjongArt hero />
    </div>
  </section>;
}
