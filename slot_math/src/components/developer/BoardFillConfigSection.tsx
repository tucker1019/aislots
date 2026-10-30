import { NumericConfigInput } from '../NumericConfigInput';
import type { CascadeGame } from './useCascadeGame';

export function BoardFillConfigSection({ game, comparing }: { game: CascadeGame; comparing: boolean }) {
  return <section className="dev-section">
    <h2>补空规则</h2>
    <fieldset className="dev-fill-settings" disabled={game.locked || comparing}>
      <label>普通图标抽中后加权 n
        <NumericConfigInput aria-label="补空累计加权" min="0" max="1000000000" step="any"
          value={game.config.fillWeightIncrement}
          onValueChange={value => game.changeConfig({ fillWeightIncrement: value })} />
      </label>
      {game.config.symbols.filter(symbol=>symbol.role==='scatter').map(symbol=><label key={symbol.id}>{symbol.name}基础补空权重
        <NumericConfigInput aria-label={`${symbol.name}基础补空权重`} min="0" step="any" value={symbol.weight} onValueChange={value=>game.updateSymbol(symbol.id,{weight:value})}/>
      </label>)}
      <label>免费图标换列加权 n
        <NumericConfigInput aria-label="免费图标换列加权" min="0" max="1000000000" step="any" value={game.config.scatterWeightIncrement} onValueChange={value=>game.changeConfig({scatterWeightIncrement:value})}/>
      </label>
    </fieldset>
    <p>普通图标累计加权，换列不重置。免费图标首轮第1列用基础权重，此后每列恢复基础权重＋免费 n，不逐列累加；抽中后本列本轮禁用。已有免费图标保留、掉落，不占后续轮次名额。基础权重为0时不参与补空。</p><p>均保存到 board.json，工作区、模拟及后续服务端共用。</p>
  </section>;
}
