export const RULES_CSS = `
.slot-history{position:fixed;z-index:12000;background:#282832;color:#f5f4f7;display:flex;flex-direction:column;overflow:hidden;font-family:Nunito,Arial,sans-serif;line-height:1.3;text-align:left;box-sizing:border-box;touch-action:pan-y;overscroll-behavior:contain;--accent:#bb7c4b;--muted:#9998a2;transform:translateY(100%);transition:transform .28s ease-out}
.slot-history.is-visible{transform:translateY(0)}
.slot-history *{box-sizing:border-box}
.slot-history[hidden],.slot-history [hidden]{display:none!important}
.slot-history button,.slot-history select{font:inherit;color:inherit;cursor:pointer}
.slot-history button{border:0;background:none}
.slot-history button:focus-visible,.slot-history select:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.history-header{height:4.6em;flex:none;background:#30303e;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 3em}
.history-header h1{margin:0;font-size:1.4em;font-weight:500;line-height:1.3;white-space:nowrap}
.history-back{position:absolute;left:.75em;top:50%;transform:translateY(-50%);min-width:2.4em;min-height:2.6em;padding:.4em!important;font-size:.8em!important}
.history-scroll{flex:1;overflow:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:none;scrollbar-gutter:auto}
.history-scroll::-webkit-scrollbar{display:none;width:0;height:0}
.history-scroll-viewport{position:relative;display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
.history-scroll-track{position:absolute;z-index:4;right:2px;top:0;bottom:0;width:5px;pointer-events:none}
.history-scroll-thumb{position:absolute;top:0;right:0;width:5px;background:#60606a;border-radius:3px;pointer-events:auto;touch-action:none;cursor:grab}
.slot-rules .rules-copy{padding:1em 2em 2.5em;color:#aaa9b3;font-size:.88em;line-height:1.75}
.slot-rules .rules-section{padding:.5em 0 1.3em;border-bottom:1px solid #3b3a46;margin-bottom:1.5em}
.slot-rules h2{color:#f5f4f7;font-size:1.15em;font-weight:500;text-align:center;margin:.5em 0 1.1em}
.slot-rules h3{color:var(--accent);font-size:1em;font-weight:500;margin:1.2em 0 .5em}
.slot-rules ul{padding-left:1.2em;margin:0}.slot-rules li{padding-left:.15em;margin-bottom:.8em}
.slot-rules p{margin:0 0 1em}

#ag4-paytable .rules-copy{padding:1em 1.5em 2.5em}
#ag4-paytable .pay-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9em .7em;margin:1.5em 0}
#ag4-paytable .pay-card{display:flex;flex-direction:column;align-items:center;gap:.35em;min-width:0;background:#30303e;border-radius:.5em;padding:.7em .45em;color:var(--accent)}
#ag4-paytable .pay-wild{grid-column:1/-1;justify-self:center;width:calc((100% - 1.4em)/3)}
#ag4-paytable .pay-symbol{display:block;width:100%;height:5em;overflow:hidden}
#ag4-paytable .pay-illustration{display:block;max-width:100%;width:80%;height:auto;margin:1em auto}
`;
