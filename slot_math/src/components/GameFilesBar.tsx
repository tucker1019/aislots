import { useGameWorkspace } from '../state/GameWorkspace';
export function GameFilesBar() {
  const { games, selected, setSelected, document, loading, saving, load, error } = useGameWorkspace();
  return <>
    <section className="game-file-panel" aria-label="游戏文件">
      <label>游戏 ID<select aria-label="游戏 ID" value={selected} disabled={loading || saving} onChange={event => setSelected(event.target.value)}><option value="">请选择游戏</option>{games.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
      <button className="button secondary" disabled={!selected || loading || saving} onClick={() => void load()}>{loading ? '正在读取…' : '读取游戏文件'}</button>
      <div><strong>{document ? `当前游戏：${document.gameId}` : '尚未读取游戏'}</strong><p>{document ? `game_configs/${document.gameId}/` : '选择游戏；下次打开自动读取上次成功加载的游戏。'}</p></div>
    </section>
    {error && <div className="alert" role="alert">{error}{document ? ' 当前工作区保留上次读取的游戏。' : ''}</div>}
  </>;
}
