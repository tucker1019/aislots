import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { LobbyPage } from './LobbyPage';
vi.mock('../services/account', () => ({ loadAccountProfile: vi.fn().mockResolvedValue({ uid: 7, nickname: '测试用户', avatarId: 1, coins: 12345 }) }));
beforeEach(() => { window.history.replaceState(null, '', '/'); });
vi.mock('../services/recharge', () => ({ fetchRechargeTiers: vi.fn().mockResolvedValue([{id:'a',amount:1000,bonus:0,fee:20,creditAmount:980}]), createRecharge: vi.fn(), fetchRechargeOrder: vi.fn(), paymentLink: vi.fn() }));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<ConfigProvider theme={{ token: { motion: false } }}><QueryClientProvider client={client}><LobbyPage /></QueryClientProvider></ConfigProvider>);
  return userEvent.setup();
}
it('保留资料顶栏，按通知、Banner、厂商、游戏顺序排布，只有一张麻将卡片', async () => {
  setup();
  expect(await screen.findByLabelText('金币余额 123.45')).toBeInTheDocument();
  const main = screen.getByRole('main');
  const regions = Array.from(main.children).map(element => element.getAttribute('aria-label'));
  expect(regions).toEqual(['通知', '轮播', '游戏厂商', '游戏列表']);
  const providers = within(screen.getByRole('navigation', { name: '游戏厂商' }));
  expect(providers.getAllByRole('button').map(button => button.textContent)).toHaveLength(2);
  expect(providers.getByRole('button', { name: '热门' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(screen.getByRole('region', { name: '游戏列表' })).getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button', { name: '进入麻将胡了' })).toBeEnabled();
});
it('AG与热门切换显示现有游戏，隐藏未接入厂商', async () => {
  const user = setup();
  await user.click(screen.getByRole('button', { name: 'AG' }));
  for (const provider of ['PG', 'JILI', 'PP']) {
    expect(screen.queryByRole('button', { name: provider })).not.toBeInTheDocument();
  }
  expect(screen.getByRole('button', { name: '进入麻将胡了' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '热门' }));
  expect(screen.getByRole('button', { name: '热门' })).toHaveAttribute('aria-pressed', 'true');
});

it('底栏提供五个入口，未开发入口提示敬请期待', async () => {
  const user = setup();
  const navigation = within(screen.getByRole('navigation', { name: '底部导航' }));
  expect(navigation.getAllByRole('button')).toHaveLength(5);
  expect(navigation.getByRole('button', { name: '首页' })).toHaveAttribute('aria-current', 'page');
  await user.click(navigation.getByRole('button', { name: '优惠' }));
  expect(await screen.findByText('敬请期待')).toBeInTheDocument();
});

it('我的显示真实资料和功能分组，可返回首页', async () => {
  const user = setup();
  const navigation = within(screen.getByRole('navigation', { name: '底部导航' }));
  await user.click(navigation.getByRole('button', { name: '我的' }));
  expect(await screen.findByRole('heading', { name: '测试用户' })).toBeInTheDocument();
  expect(screen.getByText('ID：7')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '每日签到' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '安全中心' }));
  expect(await screen.findByText('敬请期待')).toBeInTheDocument();
  await user.click(navigation.getByRole('button', { name: '首页' }));
  expect(screen.getByRole('navigation', { name: '游戏厂商' })).toBeInTheDocument();
});

it('直接打开我的路由不显示顶栏，支持历史路由更新', async () => {
  window.history.replaceState(null, '', '/my');
  setup();
  expect(await screen.findByRole('heading', { name: '测试用户' })).toBeInTheDocument();
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  window.history.replaceState(null, '', '/');
  fireEvent.popState(window);
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: '游戏厂商' })).toBeInTheDocument();
});

it('存款底栏打开独立路由并加载档位与到账明细', async () => {
 const user=setup();
 await user.click(within(screen.getByRole('navigation',{name:'底部导航'})).getByRole('button',{name:'存款'}));
 expect(window.location.pathname).toBe('/deposit');
 expect(await screen.findByRole('heading',{name:'选择存款金额'})).toBeInTheDocument();
 expect(screen.getByText('9.80')).toBeInTheDocument();
 expect(screen.queryByRole('banner')).not.toBeInTheDocument();
});

it('我的五个福利入口统一进入福利中心，隐藏大厅导航', async () => {
 const user=setup();
 await user.click(screen.getByRole('button',{name:'我的'}));
 await screen.findByText('账户服务');
 const labels=['每日签到','每周礼金','每月礼金','晋级奖励','VIP中心'];
 for(const label of labels){
  await user.click(screen.getByRole('button',{name:label}));
  expect(window.location.pathname).toBe('/benefits');
  expect(screen.getByRole('heading',{name:'福利中心'})).toBeInTheDocument();
  expect(screen.queryByRole('navigation',{name:'底部导航'})).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'返回我的'}));
  await screen.findByText('账户服务');
 }
});
it('我的资金明细入口进入独立路由并隐藏底栏',async()=>{
 const user=setup();await user.click(screen.getByRole('button',{name:'我的'}));await screen.findByText('账户服务');await user.click(screen.getByRole('button',{name:'资金明细'}));expect(window.location.pathname).toBe('/wallet-ledger');expect(screen.getByRole('heading',{name:'资金明细'})).toBeInTheDocument();expect(screen.queryByRole('navigation',{name:'底部导航'})).not.toBeInTheDocument();
});
it('赚钱入口有独立路由并选中底栏',async()=>{const user=setup();await user.click(screen.getByRole('button',{name:'赚钱'}));expect(window.location.pathname).toBe('/earn');expect(screen.getByRole('button',{name:'赚钱'})).toHaveAttribute('aria-current','page');expect(screen.getByRole('heading',{name:'反水金额'})).toBeInTheDocument();});

it('我的设置进入个人资料，返回保留我的页入口',async()=>{
 const user=setup();await user.click(screen.getByRole('button',{name:'我的'}));await user.click(await screen.findByRole('button',{name:'设置'}));expect(await screen.findByRole('heading',{name:'个人资料'})).toBeInTheDocument();expect(window.location.pathname).toBe('/profile');expect(screen.queryByRole('navigation',{name:'底部导航'})).not.toBeInTheDocument();await user.click(screen.getByRole('button',{name:'返回我的'}));expect(window.location.pathname).toBe('/my');
});
