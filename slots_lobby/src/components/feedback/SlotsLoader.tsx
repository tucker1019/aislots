import './slots-loader.css';

interface Props {
  className?: string;
}

const symbols = ['7', '◆', '●', '★', '7', '◇'];
const reelSymbols = Array.from({length: 24}, (_, index) => symbols[index % symbols.length]);

/** A compact, decorative slot-machine loader that does not affect surrounding layout. */
export function SlotsLoader({className = ''}: Props) {
  return <span className={`slots-loader${className ? ` ${className}` : ''}`} role="presentation" aria-hidden="true">
    <span className="slots-loader-light" />
    <span className="slots-loader-window">
      {[0, 1, 2].map(reel => <span className={`slots-loader-reel slots-loader-reel-${reel + 1}`} key={reel}>
        <span className="slots-loader-strip">
          {[0, 1, 2].map(index => <span className="slots-loader-symbol" key={`${reel}-start-${index}`}>7</span>)}
          {reelSymbols.map((symbol, index) => <span className="slots-loader-symbol" key={`${reel}-${index}`}>{symbol}</span>)}
          {[0, 1, 2].map(index => <span className="slots-loader-symbol" key={`${reel}-end-${index}`}>7</span>)}
        </span>
      </span>)}
    </span>
    <span className="slots-loader-lever">
      <span className="slots-loader-lever-stick" />
      <span className="slots-loader-lever-ball" />
    </span>
    <span className="slots-loader-base" />
  </span>;
}
