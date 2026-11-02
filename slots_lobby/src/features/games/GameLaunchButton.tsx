import { Button, Tooltip } from 'antd';
import { Icon } from '../../components/Icon';
import { useLobbyStore } from '../../stores/lobby';
import type { Game } from './types';
export function GameLaunchButton({ game, hero = false }: { game: Game; hero?: boolean }) {
  const recordVisit = useLobbyStore(state => state.recordVisit);
  const ready = game.status === 'available' && !!game.launchUrl;
  if (!ready) return <Tooltip title={game.status === 'upcoming' ? '游戏正在筹备，敬请期待' : '游戏启动入口尚未配置'}>
    <span><Button className="upcoming-button" disabled>{game.status === 'upcoming' ? '筹备中' : '入口待配置'}</Button></span>
  </Tooltip>;
  // 使用原生链接保留点击手势与浏览器打开能力；这不是下注或支付操作。
  return <Button type={hero ? 'primary' : 'text'} className={hero ? 'hero-play' : 'card-play'}
    href={game.launchUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordVisit(game.id)}
    aria-label={`开始游戏：${game.title}`}>
    {hero ? '开始游戏' : '开始'}<Icon name={hero ? 'arrow' : 'chevron'} size={hero ? 17 : 14} />
  </Button>;
}
