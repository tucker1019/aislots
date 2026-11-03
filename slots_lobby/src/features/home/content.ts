import { t } from '../../i18n';
// 通知和Banner接口尚未提供，集中管理当前确认的本地展示内容。
export const welcomeNotice = () => (t('copy.welcomeToAislotsEnjoyYourGames'));
export const mahjongGame = () => ({ title: t('copy.mahjongWays'), cover: '/assets/lobby/mahjong-cover.jpg' });
export type AvailableProvider = 'hot' | 'AG';
