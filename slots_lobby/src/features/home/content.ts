import { t } from '../../i18n';
// Local fallback remains immediately available while published display content loads.
export const welcomeNotice = () => (t('copy.welcomeToAislotsEnjoyYourGames'));
export const mahjongGame = () => ({ title: t('copy.mahjongWays'), cover: '/assets/lobby/mahjong-icon.png' });
export type AvailableProvider = 'hot' | 'AG';
