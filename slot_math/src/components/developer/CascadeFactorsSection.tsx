import { NumericConfigInput } from '../NumericConfigInput';
import type { CascadeGame } from './useCascadeGame';

/** Independent multiplier ladders; each last configured step repeats. */
export function CascadeFactorsSection({ game }: { game: CascadeGame }) {
  const { config, locked, changeConfig } = game;
  return <section className="dev-section">
    <h2>连续消除加成</h2>
    <p>普通、免费分别配置。超过各自档数后持续使用最后一档。</p>
    {(['cascadeFactors', 'freeCascadeFactors'] as const).map(key => {
      const label = key === 'cascadeFactors' ? '普通' : '免费';
      const factors = config[key];
      return <fieldset disabled={locked} key={key}>
        <legend>{label}加成</legend>
        <div className="dev-factors">
          {factors.map((factor, i) => <label key={i}>第 {i + 1} 轮
            <NumericConfigInput min="0.000001" step="any" aria-label={`${label}第${i + 1}轮消除加成`} value={factor}
              onValueChange={value => changeConfig({ [key]: factors.map((x, j) => j === i ? value : x) })} />
          </label>)}
        </div>
        <div className="dev-buttons">
          <button disabled={locked || factors.length >= 30} onClick={() => changeConfig({ [key]: [...factors, factors.at(-1)!] })}>增加{label}一档</button>
          <button disabled={locked || factors.length <= 1} onClick={() => changeConfig({ [key]: factors.slice(0, -1) })}>删除{label}末档</button>
        </div>
      </fieldset>;
    })}
  </section>;
}
