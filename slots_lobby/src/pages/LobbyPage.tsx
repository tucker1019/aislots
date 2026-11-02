import { useRef, useState } from 'react';
import { Button, Input, Modal, Segmented } from 'antd';
import type { InputRef } from 'antd';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Icon } from '../components/Icon';
import { GamesEmpty, GamesError, GamesLoading } from '../components/AsyncState';
import { FeaturedGame } from '../features/games/FeaturedGame';
import { GameCard } from '../features/games/GameCard';
import { filterGames } from '../features/games/filterGames';
import { useGames } from '../features/games/useGames';
import { useLobbyStore } from '../stores/lobby';
import type { Category, LobbyView } from '../features/games/types';
const titles: Record<LobbyView, string> = { discover: '发现你的下一款心动', favorites: '喜欢的，都在这里', recent: '继续你的好时光' };
export function LobbyPage() {
  const { data: games = [], isPending, isError, isFetching, refetch } = useGames();
  const view = useLobbyStore(state => state.view);
  const setView = useLobbyStore(state => state.setView);
  const favoriteIds = useLobbyStore(state => state.favoriteIds);
  const recentIds = useLobbyStore(state => state.recentIds);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [about, setAbout] = useState(false);
  const catalog = useRef<HTMLElement>(null);
  const search = useRef<InputRef>(null);
  const featured = games.find(game => game.featured && game.art === 'mahjong');
  const visible = filterGames(games, { view, category, query, favoriteIds, recentIds });
  const favoriteCount = games.filter(game => favoriteIds.includes(game.id)).length;
  const navigate = (next: LobbyView) => {
    setView(next); setQuery(''); setCategory('all');
    if (next !== 'discover') catalog.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const explore = () => catalog.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const clearFilters = () => { setQuery(''); setCategory('all'); };
  const empty = query.trim() || category !== 'all';
  return <>
    <a className="skip-link" href="#catalog">跳到游戏列表</a>
    <Header view={view} favoriteCount={favoriteCount} onNavigate={navigate} onSearch={() => {
      explore(); search.current?.focus({ preventScroll: true });
    }} onAbout={() => setAbout(true)} />
    <main>
      {view === 'discover' && featured && !isError && <FeaturedGame game={featured} onExplore={explore} />}
      {view === 'discover' && isPending && <div className="featured-placeholder" aria-hidden="true" />}
      <section className={`catalog-section${view !== 'discover' ? ' collection-section' : ''}`} id="catalog" ref={catalog} aria-labelledby="catalog-heading">
        <div className="section-heading"><div><div className="section-eyebrow">{view === 'discover' ? '好游戏，不止一种' : '专属于你的小小收藏夹'}</div>
          <h2 id="catalog-heading">{titles[view]}</h2></div>
          <div className="catalog-caption">{isPending ? '正在为你准备…' : `${games.filter(game => game.status === 'available').length} 款已上线，更多新作筹备中`}</div>
        </div>
        <div className="catalog-toolbar">
          <div className="category-control"><Segmented<Category> value={category} onChange={setCategory}
            aria-label="按玩法筛选" options={[{ label: '全部游戏', value: 'all' }, { label: '连续消除', value: 'cascade' }, { label: '连线玩法', value: 'lines' }]} /></div>
          <Input ref={search} id="game-search" className="game-search" aria-label="搜索游戏名称或主题" placeholder="搜索游戏名称或主题"
            prefix={<Icon name="search" size={17} />} allowClear maxLength={80} value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="catalog-results" aria-live="polite" aria-atomic="true">
          {!isPending && !isError && <span>{empty ? `找到 ${visible.length} 款游戏` : view === 'favorites' ? `${visible.length} 款收藏` : view === 'recent' ? `${visible.length} 款最近玩过` : '为每一种心情，选一款好游戏。'}</span>}
          {empty && !isError && <Button type="link" size="small" onClick={clearFilters}>清除筛选</Button>}
        </div>
        {isPending ? <GamesLoading /> : isError ? <GamesError retry={() => void refetch()} loading={isFetching} />
          : visible.length ? <div className="game-grid">{visible.map(game => <GameCard game={game} key={game.id} />)}</div>
            : <GamesEmpty title={empty ? '没有找到合适的游戏' : view === 'favorites' ? '这里还没有收藏' : view === 'recent' ? '还没有开始过游戏' : '新游戏正在准备中'}
              description={empty ? '试试其他关键词，或清除玩法筛选。' : view === 'favorites' ? '看到喜欢的游戏，点一下爱心，下次就能轻松找到。' : view === 'recent' ? '从大厅开始一款游戏，它就会出现在这里。' : '稍后再来看看，也许会有新的惊喜。'}
              loading={!empty && view === 'discover' && isFetching}
              action={empty ? '清除筛选' : view === 'discover' ? '重新加载' : '发现游戏'} reset={() => {
                if (empty) clearFilters(); else if (view === 'discover') void refetch(); else navigate('discover');
              }} />}
        {view === 'discover' && !isPending && !isError && games.length > 0 && <div className="coming-note">
          <span className="coming-note-symbol" aria-hidden="true">✧</span><div><h3>下一份惊喜，正在准备。</h3><p>新世界、新玩法。更多好游戏，即将陆续登场。</p></div><span className="coming-note-end">保持期待</span>
        </div>}
      </section>
    </main>
    <Footer onAbout={() => setAbout(true)} />
    <Modal title="关于 AISlots" open={about} onCancel={() => setAbout(false)} footer={<Button type="primary" onClick={() => setAbout(false)}>知道了</Button>} centered width={440}>
      <div className="about-copy"><p>AISlots，让喜欢的游戏，随时在你身边。</p><p>当前为大厅预览版：麻将胡了已接入，其余卡片为筹备内容，暂时无法进入。</p><p>收藏和最近玩过仅保存在当前浏览器，不会上传个人偏好。</p></div>
    </Modal>
  </>;
}
