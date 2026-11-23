import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DocumentFields } from './DocumentFields';
import { arrayTemplate, validImagePath, validMapKey } from './configTemplates';
import type { Json } from '../services/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
beforeAll(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) }); });
afterEach(cleanup);
function Fixture({ initial, path }: { initial: Json; path: string }) {
 const [value, setValue] = useState(initial);
 return <><DocumentFields value={value} onChange={setValue} path={path} /><output data-testid="document">{JSON.stringify(value)}</output></>;
}
describe('section-aware structured configuration', () => {
 it('adds a game entry with all required typed fields', () => {
  render(<Fixture initial={{ AG1: { enabled: true, url: 'https://example.com', provider: 'AG', name: 'Existing', apiUrl: '' } }} path="games.games" />);
  fireEvent.change(screen.getByLabelText('games.games 新增标识'), { target: { value: 'PG2' } });
  fireEvent.click(screen.getByRole('button', { name: '新增条目' }));
  const result: unknown = JSON.parse(screen.getByTestId('document').textContent ?? '{}');
  expect(result).toMatchObject({ PG2: { enabled: false, visible: true, sort: 10, cover: '', nameEn: '', url: '', provider: '', name: '', apiUrl: '' }, AG1: { name: 'Existing' } });
 });
 it('restores an array after its last item is removed', () => {
  render(<Fixture initial={[{ id: 'first', amount: 100, bonus: 0, fee: 0 }]} path="recharge" />);
  fireEvent.click(screen.getByRole('button', { name: '项目 1' }));
  fireEvent.click(screen.getByRole('button', { name: '移除此项目' }));
  expect(screen.getByTestId('document').textContent).toBe('[]');
  fireEvent.click(screen.getByRole('button', { name: '添加项目' }));
  expect(JSON.parse(screen.getByTestId('document').textContent ?? '[]')).toEqual([{ id: '', amount: 0, bonus: 0, fee: 0 }]);
 });
 it('blocks invalid and duplicate map identifiers', () => {
  render(<Fixture initial={{ AG1: {} }} path="games.games" />);
  for (const key of ['AG1', '__proto__', 'invalid key', '1ABC', 'constructor']) {
   fireEvent.change(screen.getByLabelText('games.games 新增标识'), { target: { value: key } });
   expect(screen.getByRole('button', { name: '新增条目' }).hasAttribute('disabled')).toBe(true);
  }
  expect(validMapKey('PG-2', {})).toBe(true);
 });
 it('supports empty provider tiers and every declared empty section array', () => {
  for (const path of ['recharge', 'withdrawal', 'checkin.days', 'vip.levels', 'newbie-recharge.tiers', 'agent.providers.AG', 'content.announcements.zh-TW', 'content.announcements.en-US', 'content.banners','reward-notifications.rebate.reminderHours']) expect(arrayTemplate(path)).not.toBeUndefined();
  render(<Fixture initial={[]} path="agent.providers.AG" />);
  fireEvent.click(screen.getByRole('button', { name: '添加项目' }));
  expect(screen.getByTestId('document').textContent).toBe('[{"threshold":0,"rate":0}]');
 });
 it('provides a twelve hour starter reminder value and exposes notification controls', () => {
  render(<Fixture initial={{ rebate: { sendOnSettlement: true, reminderHours: [], sendOnExpired: true }, leaderboard: { sendOnSettlement: true, reminderHours: [12,6], sendOnExpired: true }, lossReturn: { sendOnSettlement: false, reminderHours: [], sendOnExpired: false } }} path="reward-notifications" />);
  expect(arrayTemplate('reward-notifications.rebate.reminderHours')).toBe(12);
  expect(screen.getByLabelText('reward-notifications.rebate.sendOnSettlement')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '项目 1' }));
  expect(screen.getByLabelText('reward-notifications.leaderboard.reminderHours[0]')).toBeTruthy();
  expect(screen.getByLabelText('reward-notifications.lossReturn.sendOnExpired')).toBeTruthy();
 });
 it('limits banner routes and rejects unsafe image references', () => {
  for (const value of ['//cdn.example/a.png', 'javascript:alert(1)', 'http://cdn.example/a.png', '/assets/../secret']) expect(validImagePath(value)).toBe(false);
  expect(validImagePath('/assets/banner.png')).toBe(true);
  expect(validImagePath('https://cdn.example/banner.png')).toBe(true);
 });
 it('keeps turnover source keys fixed and readonly permissions disable additions', () => {
  const view = render(<DocumentFields value={{ rch_001: 1 }} path="turnover.multipliers" onChange={vi.fn()} />);
  expect(screen.queryByRole('button', { name: '新增条目' })).toBeNull();
  expect(screen.queryByRole('button', { name: '删除 rch_001' })).toBeNull();
  view.rerender(<DocumentFields value={{}} path="games.games" disabled onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: '新增条目' }).hasAttribute('disabled')).toBe(true);
 });
});

it('edits catalog visibility, availability and order independently',()=>{
 render(<Fixture initial={{AG1:{enabled:true,visible:true,sort:10,name:'One',provider:'AG',cover:'/assets/one.png',url:'https://game.example/'}}} path="games.games"/>);
 fireEvent.click(screen.getByLabelText('games.games.AG1.visible'));
 fireEvent.click(screen.getByLabelText('games.games.AG1.enabled'));
 fireEvent.change(screen.getByLabelText('games.games.AG1.sort'),{target:{value:'35'}});
 expect(JSON.parse(screen.getByTestId('document').textContent??'{}').AG1).toMatchObject({visible:false,enabled:false,sort:35});
});

it('edits per-game display metrics with a fixed volatility selector',()=>{
 render(<Fixture initial={{}} path="games.games"/>);
 fireEvent.change(screen.getByLabelText('games.games 新增标识'),{target:{value:'AG2'}});
 fireEvent.click(screen.getByRole('button',{name:'新增条目'}));
 expect((screen.getByLabelText('games.games.AG2.theoreticalRtp') as HTMLInputElement).value).toBe('97.00');
 fireEvent.change(screen.getByLabelText('games.games.AG2.theoreticalRtp'),{target:{value:'96.5'}});
 fireEvent.change(screen.getByLabelText('games.games.AG2.maxWin'),{target:{value:'5000'}});
 fireEvent.mouseDown(screen.getByLabelText('games.games.AG2.volatility'));
 fireEvent.click(screen.getByText('极高'));
 expect(JSON.parse(screen.getByTestId('document').textContent??'{}')).toMatchObject({AG2:{theoreticalRtp:96.5,volatility:'extreme',maxWin:5000}});
 fireEvent.change(screen.getByLabelText('games.games.AG2.maxWin'),{target:{value:'-1'}});
 expect(JSON.parse(screen.getByTestId('document').textContent??'{}')).toMatchObject({AG2:{maxWin:-1}});
});

it('exposes legacy experience funding defaults and preserves other fields on edit', () => {
 const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:0}}});
 client.setQueryData(['config','games'],{published:{games:{}}});
 render(<QueryClientProvider client={client}><Fixture initial={{enabled:false,gameWeights:{AG2:3},createMinSeconds:30,createMaxSeconds:120,playMinSeconds:10,playMaxSeconds:30}} path="experience" /></QueryClientProvider>);
 expect(screen.getByLabelText('experience.initialCoinsMin').getAttribute('value')).toBe('10000');
 expect(screen.getByLabelText('experience.initialCoinsMax').getAttribute('value')).toBe('1000000');
 expect(screen.getByLabelText('experience.initialCoinsStep').getAttribute('value')).toBe('10000');
 expect(screen.getByLabelText('experience.betDivisorMin').getAttribute('value')).toBe('100');
 fireEvent.change(screen.getByLabelText('experience.initialCoinsMax'), {target:{value:'5000000'}});
 expect(JSON.parse(screen.getByTestId('document').textContent??'{}')).toMatchObject({enabled:false,gameWeights:{AG2:3},initialCoinsMin:10000,initialCoinsMax:5000000,initialCoinsStep:10000,betDivisorMin:100,betDivisorMax:300,createMinSeconds:30});
});

it('shows live percentage examples for every rebate rate and hides legacy loss fields', () => {
 render(<Fixture initial={{dailyRateBps:80,weeklyRateBps:10,monthlyRateBps:10,loserReturnRateBps:1000}} path="returns"/>);
 expect(screen.getByText(/当前：80 基点 = 0.8%/)).toBeTruthy();
 expect(screen.getAllByText(/当前：10 基点 = 0.1%/)).toHaveLength(2);
 expect(screen.queryByLabelText('returns.loserReturnRateBps')).toBeNull();
 fireEvent.change(screen.getByLabelText('returns.dailyRateBps'), {target:{value:'1000'}});
 expect(screen.getByText(/当前：1000 基点 = 10%/)).toBeTruthy();
 expect(JSON.parse(screen.getByTestId('document').textContent??'{}')).toEqual({dailyRateBps:1000,weeklyRateBps:10,monthlyRateBps:10});
});
it('edits loss fee and each fixed reward switch independently, preserving explicit zero and false', () => {
 render(<Fixture initial={{loserReturnRateBps:1000,platformFeeRateBps:0,rewardSources:{checkin:false}}} path="loss-return"/>);
 expect(screen.getByText(/当前：0 基点 = 0%/)).toBeTruthy();
 expect(screen.getByLabelText('loss-return.rewardSources.checkin').getAttribute('aria-checked')).toBe('false');
 expect(screen.getByLabelText('loss-return.rewardSources.agentCommission').getAttribute('aria-checked')).toBe('false');
 expect(screen.getByLabelText('loss-return.rewardSources.inviteReward').getAttribute('aria-checked')).toBe('false');
 fireEvent.click(screen.getByLabelText('loss-return.rewardSources.agentCommission'));
 expect(JSON.parse(screen.getByTestId('document').textContent??'{}')).toMatchObject({loserReturnRateBps:1000,platformFeeRateBps:0,rewardSources:{checkin:false,rebate:false,agentCommission:true,inviteReward:false}});
 expect(screen.getAllByRole('switch')).toHaveLength(11);
 expect(screen.getByText(/1000 − 600 − 100 − 40 = 260/)).toBeTruthy();
});
