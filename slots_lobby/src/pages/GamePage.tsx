import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { forgetGameEntry, launchGame, readGameEntry, rememberGameEntry } from '../services/game-entry';

export function GamePage({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState(readGameEntry);
  const [loading, setLoading] = useState(Boolean(url));
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const alive = useRef(true);
  const client = useQueryClient();
  useEffect(() => {
    alive.current = true;
    // 工具栏返回或浏览器返回都重新获取大厅余额，不使用进入前的缓存。
    void client.invalidateQueries({ queryKey: ['lobby', 'current-profile'], refetchType: 'none' });
    return () => { alive.current = false; };
  }, [client]);
  async function reopen() {
    if (busy.current) return;
    busy.current = true; setPreparing(true); setError('');
    try {
      const next = await launchGame('AG1');
      if (!alive.current) return;
      rememberGameEntry(next); setLoading(true); setUrl(next);
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : '无法进入游戏，请重试');
    } finally {
      busy.current = false;
      if (alive.current) setPreparing(false);
    }
  }
  return <section className="embedded-game" aria-label="麻将胡了游戏">
    <header className="embedded-game-toolbar">
      <button type="button" onClick={() => { forgetGameEntry(); onBack(); }}>返回大厅</button>
      <span>麻将胡了</span>
      <button type="button" disabled={preparing} onClick={() => { void reopen(); }}>{preparing ? '连接中…' : '重新进入'}</button>
    </header>
    <div className="embedded-game-content">
      {url ? <iframe key={url} src={url} title="AG1 麻将胡了" allow="autoplay; fullscreen; clipboard-write"
        allowFullScreen referrerPolicy="no-referrer" onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError('游戏加载失败，请重新进入'); }} />
        : <p role="status">请点击“重新进入”加载游戏。</p>}
      {loading && <p className="embedded-game-loading" role="status">正在加载游戏…</p>}
      {error && <p className="embedded-game-error" role="alert">{error}</p>}
    </div>
  </section>;
}
