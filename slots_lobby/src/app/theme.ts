import {theme as antTheme} from 'antd';
import type {ThemeConfig} from 'antd';
import type {ThemeMode} from '../stores/theme';

const fontFamily = 'var(--lobby-font)';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#087a41', colorInfo: '#155caa', colorText: '#1d1e21',
    colorTextSecondary: '#656b75', colorBgLayout: '#f1f2f4', colorBorder: '#dadde3',
    colorBgContainer: '#fff', borderRadius: 10, fontSize: 15, fontFamily, fontWeightStrong: 700,
    controlHeight: 42, colorLink: '#155caa',
  },
  components: {
    Modal: {titleFontSize: 17},
    Button: {primaryShadow: 'none', borderRadius: 10, fontWeight: 700},
  },
};

const darkTheme: ThemeConfig = {
  ...theme,
  algorithm: antTheme.darkAlgorithm,
  token: {
    ...theme.token, borderRadius: 14, colorPrimary: '#ff9179', colorInfo: '#ff9179', colorLink: '#ff9179',
    colorSuccess: '#8ed6ad', colorWarning: '#f4d49a', colorError: '#ffafb4',
    colorText: '#fff6ed', colorTextSecondary: '#c0b9d0',
    colorBgLayout: '#17152a', colorBgContainer: '#252039', colorBgElevated: '#342d4b',
    colorBorder: '#4a405e', colorTextPlaceholder: '#c0b9d0', colorTextDisabled: '#c0b9d0',
  },
  components: {
    ...theme.components,
    Button: {
      ...theme.components?.Button, colorPrimary: '#ff9179', colorPrimaryHover: '#ffa58f', colorPrimaryActive: '#ed7c65',
      defaultBg: '#342d4b', defaultBorderColor: '#665575',
      colorBgContainerDisabled: 'var(--theme-disabled)',
      borderColorDisabled: 'var(--theme-disabled-border)',
      colorTextDisabled: 'var(--theme-disabled-ink)',
      primaryColor: '#251624', colorPrimaryText: '#ff9179', colorPrimaryTextHover: '#ffa58f',
    },
  },
};

export function getLobbyTheme(mode: ThemeMode): ThemeConfig {
  return mode === 'dark' ? darkTheme : theme;
}
