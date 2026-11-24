export function Brand() {
  return <span className="brand" aria-label="aggames.buzz">
    <span className="brand-wordmark">
      <span className="brand-name">{'aggames'.split('').map((letter, index) => {
        const animationDelay = `${1 + index * .14}s`;
        return <span className="brand-letter" key={index} style={{animationDelay}}>
          {letter}<span className="brand-shine" aria-hidden="true" style={{animationDelay}}>{letter}</span>
        </span>;
      })}</span><span className="brand-domain">.buzz</span>
    </span>
  </span>;
}
