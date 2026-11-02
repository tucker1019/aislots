import { Brand } from './Brand';
export function Footer({ onAbout }: { onAbout: () => void }) {
  return <footer className="site-footer"><div className="footer-inner">
    <div><Brand compact /><p>把好时光，留给好游戏。</p></div>
    <div className="footer-right"><button onClick={onAbout}>关于大厅</button><span>© 2026 AISlots</span></div>
  </div></footer>;
}
