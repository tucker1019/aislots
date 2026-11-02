import { Button, Tooltip } from 'antd';
import { Icon } from '../../components/Icon';
import { useLobbyStore } from '../../stores/lobby';
export function FavoriteButton({ id, title }: { id: string; title: string }) {
  const selected = useLobbyStore(state => state.favoriteIds.includes(id));
  const toggle = useLobbyStore(state => state.toggleFavorite);
  const label = `${selected ? '取消收藏' : '收藏'}${title}`;
  return <Tooltip title={selected ? '取消收藏' : '添加收藏'}>
    <Button type="text" className={`favorite-button${selected ? ' is-favorite' : ''}`}
      aria-label={label} aria-pressed={selected} onClick={() => toggle(id)}
      icon={<Icon name="heart" size={18} filled={selected} />} />
  </Tooltip>;
}
