const symbols = ['h_white', 'h_red', 'h_green', 'l_ball_5', 'l_bamboo_2'];
/** 牌面来自现有 AG1 资源；同一组合用于精选区与游戏卡。 */
export function MahjongArt({ hero = false }: { hero?: boolean }) {
  return <div className={`mahjong-art${hero ? ' mahjong-art-hero' : ''}`} aria-hidden="true">
    <div className="mahjong-orbit orbit-one" /><div className="mahjong-orbit orbit-two" />
    <div className="tile-composition">
      {symbols.map((symbol, index) => <div className={`mahjong-tile tile-${index}`} key={symbol}>
        <img className="tile-base" src="/assets/mahjong/symbol_base_white.png" alt="" draggable="false" />
        <img className="tile-face" src={`/assets/mahjong/${symbol}.png`} alt="" draggable="false" />
      </div>)}
    </div>
    {hero && <><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✧</span>
      <span className="art-caption">经典牌面 · 连消新趣</span></>}
  </div>;
}
