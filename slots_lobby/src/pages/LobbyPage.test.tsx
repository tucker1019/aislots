vi.mock('../services/recent-wins',()=>({fetchRecentWins:vi.fn().mockResolvedValue({items:[],updatedAt:'2026-11-21T00:00:00Z'}),fetchRecentWinReplay:vi.fn(),recentWinMoney:vi.fn()}));
import { readGameEntry, rememberGameEntry } from '../services/game-entry';
import { navigateLobby } from '../app/useLobbyRoute';
import { act } from '@testing-library/react';
import {testGames} from '../test/game-catalog';
import {beforeEach as authenticatedFixture} from 'vitest';
import {useSessionStore} from '../stores/session';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { LobbyPage } from './LobbyPage';
vi.mock('../services/game-favorites',()=>({fetchGameFavorites:vi.fn().mockResolvedValue(['AG2','AG_HIDDEN']),setGameFavorite:vi.fn()}));
vi.mock('../services/account', () => ({ loadAccountProfile: vi.fn().mockResolvedValue({ uid: 7, nickname: '測試用戶', avatarId: 1, coins: 12345 }) }));
beforeEach(() => { window.history.replaceState(null, '', '/'); });
vi.mock('../services/recharge', () => ({ fetchRechargeTiers: vi.fn().mockResolvedValue([{id:'a',amount:1000,bonus:0,fee:20,creditAmount:980}]), createRecharge: vi.fn(), fetchRechargeOrder: vi.fn(), paymentLink: vi.fn() }));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(['lobby','games'],testGames);
  render(<ConfigProvider theme={{ token: { motion: false } }}><QueryClientProvider client={client}><LobbyPage /></QueryClientProvider></ConfigProvider>);
  return userEvent.setup();
}
it('保留資料頂欄，按通知、Banner、廠商、遊戲順序排布，首批顯示六行遊戲卡片', async () => {
  setup();
  expect(await screen.findByLabelText('金幣餘額 Rp123')).toBeInTheDocument();
  const main = screen.getByRole('main');
  expect(within(main).getByRole('button', { name: '福利中心' })).toBeInTheDocument();
  await screen.findByRole('button', { name: '進入麻將胡了' });
  await waitFor(()=>expect(main.querySelector('.recent-wins')).not.toBeInTheDocument());
  const regions = Array.from(main.children).filter(element => element.tagName !== 'ASIDE').map(element => element.getAttribute('aria-label'));
  expect(regions).toEqual(['通知', '輪播', '遊戲廠商', '遊戲列表']);
  const providers = within(screen.getByRole('navigation', { name: '遊戲廠商' }));
  expect(providers.getAllByRole('button').map(button => button.textContent)).toHaveLength(3);
  expect(providers.getByRole('button', { name: '熱門' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(screen.getByRole('region', { name: '遊戲列表' })).getAllByRole('button')).toHaveLength(18);
  expect(screen.getByRole('button', { name: '進入麻將胡了' })).toBeEnabled();
});
it('AG與熱門切換顯示現有遊戲，隱藏未接入廠商', async () => {
  const user = setup();
  await user.click(screen.getByRole('button', { name: 'AG' }));
  for (const provider of ['PG', 'JILI', 'PP']) {
    expect(screen.queryByRole('button', { name: provider })).not.toBeInTheDocument();
  }
  expect(screen.getByRole('button', { name: '進入麻將胡了' })).toBeInTheDocument();
  const hot = screen.getByRole('button', { name: '熱門' });
  const icon = hot.querySelector('svg');
  expect(icon).toBeInTheDocument();
  await user.click(icon!);
  expect(hot).toHaveAttribute('aria-pressed', 'true');
});

it('底欄僅保留首頁、存款、賺錢、我的', () => {
  setup();
  const navigation = within(screen.getByRole('navigation', { name: '底部導航' }));
  expect(navigation.getAllByRole('button')).toHaveLength(4);
  expect(navigation.queryByRole('button', { name: '優惠' })).not.toBeInTheDocument();
  expect(navigation.getByRole('button', { name: '首頁' })).toHaveAttribute('aria-current', 'page');
  for (const name of ['存款', '賺錢', '我的']) expect(navigation.getByRole('button', { name })).toBeInTheDocument();
});

it('我的顯示真實資料和功能分組，可返回首頁', async () => {
  const user = setup();
  const navigation = within(screen.getByRole('navigation', { name: '底部導航' }));
  await user.click(navigation.getByRole('button', { name: '我的' }));
  expect(await screen.findByRole('heading', { name: '測試用戶' })).toBeInTheDocument();
  expect(screen.getByText('ID：7')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '每日簽到' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '安全中心' }));
  expect(await screen.findByRole('heading',{name:'賬戶安全'})).toBeInTheDocument();
  expect(window.location.pathname).toBe('/security');
  await user.click(screen.getByRole('button',{name:'返回我的'}));
  await user.click(screen.getByRole('button', { name: '首頁' }));
  expect(screen.getByRole('navigation', { name: '遊戲廠商' })).toBeInTheDocument();
});

it('直接打開我的路由不顯示頂欄，支持歷史路由更新', async () => {
  window.history.replaceState(null, '', '/my');
  setup();
  expect(await screen.findByRole('heading', { name: '測試用戶' })).toBeInTheDocument();
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  window.history.replaceState(null, '', '/');
  fireEvent.popState(window);
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: '遊戲廠商' })).toBeInTheDocument();
});

it('存款底欄打開獨立路由並加載檔位與到賬明細', async () => {
 const user=setup();
 await user.click(within(screen.getByRole('navigation',{name:'底部導航'})).getByRole('button',{name:'存款'}));
 expect(window.location.pathname).toBe('/deposit');
 expect(await screen.findByRole('heading',{name:'選擇存款金額'})).toBeInTheDocument();
 expect(screen.getByText('Rp9')).toBeInTheDocument();
 expect(screen.queryByRole('banner')).not.toBeInTheDocument();
});

it('我的五個福利入口統一進入福利中心，隱藏大廳導航', async () => {
 const user=setup();
 await user.click(screen.getByRole('button',{name:'我的'}));
 await screen.findByText('賬戶服務');
 const labels=['每日簽到','每周禮金','每月禮金','晉級獎勵','VIP中心'];
 for(const label of labels){
  await user.click(screen.getByRole('button',{name:label}));
  expect(window.location.pathname).toBe('/benefits');
  expect(screen.getByRole('heading',{name:'福利中心'})).toBeInTheDocument();
  expect(screen.queryByRole('navigation',{name:'底部導航'})).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'返回我的'}));
  await screen.findByText('賬戶服務');
 }
});
it('我的資金明細入口進入獨立路由並隱藏底欄',async()=>{
 const user=setup();await user.click(screen.getByRole('button',{name:'我的'}));await screen.findByText('賬戶服務');await user.click(screen.getByRole('button',{name:'資金明細'}));expect(window.location.pathname).toBe('/wallet-ledger');expect(screen.getByRole('heading',{name:'資金明細'})).toBeInTheDocument();expect(screen.queryByRole('navigation',{name:'底部導航'})).not.toBeInTheDocument();
});
it('賺錢入口有獨立路由並選中底欄',async()=>{const user=setup();await user.click(screen.getByRole('button',{name:'賺錢'}));expect(window.location.pathname).toBe('/earn');expect(screen.getByRole('button',{name:'賺錢'})).toHaveAttribute('aria-current','page');expect(screen.getByRole('heading',{name:'反水金額'})).toBeInTheDocument();});

it('我的設置進入個人資料，返回保留我的頁入口',async()=>{
 const user=setup();await user.click(screen.getByRole('button',{name:'我的'}));await user.click(await screen.findByRole('button',{name:'設置'}));expect(await screen.findByRole('heading',{name:'個人資料'})).toBeInTheDocument();expect(window.location.pathname).toBe('/profile');expect(screen.queryByRole('navigation',{name:'底部導航'})).not.toBeInTheDocument();await user.click(screen.getByRole('button',{name:'返回我的'}));expect(window.location.pathname).toBe('/my');
});

authenticatedFixture(()=>useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}}));

it('收起回到大廳，恢復同一個遊戲iframe，退出才卸載', async () => {
  const src='https://game.example.test/?launchTicket=keep-existing-game';
  rememberGameEntry(src,'AG1');
  window.history.replaceState(null,'','/game/AG1');
  setup();
  const frame=document.querySelector('iframe');
  expect(frame).not.toBeNull();
  expect(frame).toHaveAttribute('src',src);
  fireEvent.click(screen.getByRole('button',{name:'收起遊戲'}));
  expect(window.location.pathname).toBe('/');
  expect(frame?.closest('.game-detail-shell')).toHaveAttribute('inert');
  expect(document.querySelector('iframe')).toBe(frame);
  const resume=screen.getByRole('button',{name:/繼續遊戲 ·/});
  fireEvent.click(resume);
  expect(window.location.pathname).toBe('/game/AG1');
  expect(document.querySelector('iframe')).toBe(frame);
  expect(frame).toHaveAttribute('src',src);
  expect(frame?.closest('.game-detail-shell')).not.toHaveAttribute('inert');
  fireEvent.click(screen.getByRole('button',{name:'返回大廳'}));
  expect(document.querySelector('iframe')).toBeNull();
  act(()=>navigateLobby('home'));
});

it('關閉恢復條會銷毀iframe並清除入口，重新進入不復用舊遊戲', () => {
  const src='https://game.example.test/?launchTicket=closed-game';
  rememberGameEntry(src,'AG1');
  window.history.replaceState(null,'','/game/AG1');
  setup();
  const original=document.querySelector('iframe');
  fireEvent.click(screen.getByRole('button',{name:'收起遊戲'}));
  expect(screen.queryByText('遊戲進行中')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'關閉遊戲'}));
  expect(document.querySelector('iframe')).toBeNull();
  expect(readGameEntry('AG1')).toBeFalsy();
  expect(window.location.pathname).toBe('/');
  expect(screen.queryByRole('button',{name:/繼續遊戲 ·/})).not.toBeInTheDocument();
  act(()=>navigateLobby('game',{gameId:'AG1'}));
  expect(original?.isConnected).toBe(false);
  expect(document.querySelector('iframe')?.getAttribute('src')).not.toBe(src);
});

it('四个主路由切换保持同一底栏和按钮节点，不重播整栏挂载动效', () => {
  setup();
  const nav=screen.getByRole('navigation',{name:'底部導航'});
  const buttons=within(nav).getAllByRole('button');
  for(const index of [1,2,3,0,2,1,0]) {
    fireEvent.click(buttons[index]);
    expect(screen.getByRole('navigation',{name:'底部導航'})).toBe(nav);
    expect(within(nav).getAllByRole('button')).toEqual(buttons);
    expect(buttons[index]).toHaveAttribute('aria-current','page');
  }
});

it('favorites category precedes providers and only shows saved catalog games', async()=>{
 const user=setup();
 const tabs=within(screen.getByRole('navigation',{name:'遊戲廠商'}));
 expect(tabs.getAllByRole('button').map(button=>button.getAttribute('class'))).toEqual(['provider-tab provider-hot','provider-tab provider-favorites','provider-tab provider-AG']);
 await user.click(tabs.getByRole('button',{name:'收藏'}));
 const list=within(screen.getByRole('region',{name:'遊戲列表'}));
 expect(await list.findByRole('button',{name:testGames.find(game=>game.id==='AG2')!.name})).toBeInTheDocument();
 expect(list.getAllByRole('button')).toHaveLength(1);
});
