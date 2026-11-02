import { beforeEach, expect, it } from 'vitest';
import { useLobbyStore } from './lobby';
beforeEach(() => { localStorage.clear(); useLobbyStore.setState({ view:'discover',favoriteIds:[],recentIds:[] }); });
it('收藏切换没有重复ID，取消后删除', () => {
  useLobbyStore.getState().toggleFavorite('AG1');
  expect(useLobbyStore.getState().favoriteIds).toEqual(['AG1']);
  useLobbyStore.getState().toggleFavorite('AG1');
  expect(useLobbyStore.getState().favoriteIds).toEqual([]);
});
it('最近玩过去重并限制12条，不持久化页面导航', () => {
  for (let index=0;index<15;index++) useLobbyStore.getState().recordVisit(String(index));
  useLobbyStore.getState().recordVisit('10');
  useLobbyStore.getState().setView('recent');
  expect(useLobbyStore.getState().recentIds).toHaveLength(12);
  expect(useLobbyStore.getState().recentIds[0]).toBe('10');
  const saved: unknown = JSON.parse(localStorage.getItem('aislots-lobby-preferences') || '{}');
  expect(saved).toEqual(expect.objectContaining({state:expect.not.objectContaining({view:'recent'})}));
});
it('损坏的持久化偏好不会进入游戏目录或页面状态', async () => {
  localStorage.setItem('aislots-lobby-preferences',JSON.stringify({version:1,state:{favoriteIds:['AG1',null,123,'AG1'],recentIds:'wrong',view:'bad'}}));
  await useLobbyStore.persist.rehydrate();
  expect(useLobbyStore.getState().favoriteIds).toEqual(['AG1']);
  expect(useLobbyStore.getState().recentIds).toEqual([]);
  expect(useLobbyStore.getState().view).toBe('discover');
});
