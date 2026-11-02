import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { LobbyPage } from './LobbyPage';
import { fetchGames } from '../services/catalog';
import { useLobbyStore } from '../stores/lobby';
import type { Game } from '../features/games/types';
vi.mock('../services/catalog', () => ({ fetchGames: vi.fn() }));
const games: Game[] = [
  { id:'AG1',title:'麻将胡了',subtitle:'Mahjong Ways',category:'cascade',art:'mahjong',status:'available',featured:true,isNew:false,description:'麻将',tags:['麻将'],launchUrl:'http://127.0.0.1:5180/' },
  { id:'candy',title:'糖果星球',subtitle:'Candy Planet',category:'cascade',art:'candy',status:'upcoming',featured:false,isNew:true,description:'筹备',tags:['糖果'] },
  { id:'seven',title:'幸运七号',subtitle:'Lucky Seven',category:'lines',art:'seven',status:'upcoming',featured:false,isNew:false,description:'筹备',tags:['经典'] },
];
function setup() {
  const client = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  render(<ConfigProvider theme={{token:{motion:false}}}><QueryClientProvider client={client}><LobbyPage /></QueryClientProvider></ConfigProvider>);
  return userEvent.setup();
}
beforeEach(() => {
  useLobbyStore.setState({view:'discover',favoriteIds:[],recentIds:[]});
  vi.mocked(fetchGames).mockReset();
});
describe('大厅用户流程', () => {
  it('请求未完成展示加载状态', () => {
    vi.mocked(fetchGames).mockReturnValue(new Promise(() => undefined));
    setup(); expect(screen.getByRole('status',{name:'正在加载游戏'})).toBeInTheDocument();
  });
  it('搜索、清除和玩法筛选可组合使用', async () => {
    vi.mocked(fetchGames).mockResolvedValue(games); const user=setup();
    await screen.findByRole('article',{name:'麻将胡了'});
    await user.type(screen.getByRole('textbox',{name:'搜索游戏名称或主题'}),'cAnDy');
    expect(screen.getByRole('article',{name:'糖果星球'})).toBeInTheDocument();
    expect(screen.queryByRole('article',{name:'麻将胡了'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'清除筛选'}));
    await user.click(screen.getByText('连线玩法',{selector:'.ant-segmented-item-label'}));
    expect(screen.getByRole('article',{name:'幸运七号'})).toBeInTheDocument();
    expect(screen.queryByRole('article',{name:'糖果星球'})).not.toBeInTheDocument();
  });
  it('收藏可进入专属列表，取消最后一条后出现空态', async () => {
    vi.mocked(fetchGames).mockResolvedValue(games);const user=setup();
    await user.click(await screen.findByRole('button',{name:'收藏麻将胡了'}));
    await user.click(within(screen.getByRole('navigation',{name:'主导航'})).getByRole('button',{name:/我的收藏/}));
    expect(screen.getByRole('article',{name:'麻将胡了'})).toBeInTheDocument();
    expect(screen.queryByRole('article',{name:'糖果星球'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'取消收藏麻将胡了'}));
    expect(screen.getByText('这里还没有收藏')).toBeInTheDocument();
  });
  it('筹备入口禁用；真实入口打开配置URL并记录最近玩过', async () => {
    vi.mocked(fetchGames).mockResolvedValue(games); setup();
    const candy=await screen.findByRole('article',{name:'糖果星球'});
    expect(within(candy).getByRole('button',{name:'筹备中'})).toBeDisabled();
    const link=within(screen.getByRole('article',{name:'麻将胡了'})).getByRole('link',{name:'开始游戏：麻将胡了'});
    expect(link).toHaveAttribute('href','http://127.0.0.1:5180/');
    expect(link).toHaveAttribute('rel','noopener noreferrer');
    link.addEventListener('click',event=>event.preventDefault());fireEvent.click(link);
    expect(useLobbyStore.getState().recentIds).toEqual(['AG1']);
  });
  it('搜索无结果有清除入口；空目录不会被伪装成加载中', async () => {
    vi.mocked(fetchGames).mockResolvedValue([]);setup();
    expect(await screen.findByText('新游戏正在准备中')).toBeInTheDocument();
    expect(screen.queryByRole('status',{name:'正在加载游戏'})).not.toBeInTheDocument();
  });
  it('错误可重试，重试成功后展示游戏', async () => {
    vi.mocked(fetchGames).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(games);
    const user=setup();await screen.findByRole('alert');
    await user.click(screen.getByRole('button',{name:'重新加载'}));
    await waitFor(()=>expect(screen.getByRole('article',{name:'麻将胡了'})).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
