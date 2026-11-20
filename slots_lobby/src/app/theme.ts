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
    ...theme.token, borderRadius: 14, colorPrimary: '#e9c88d', colorInfo: '#e9c88d', colorLink: '#e9c88d',
    colorSuccess: '#8ed6ad', colorWarning: '#e9c88d', colorError: '#ffafb4',
    colorText: '#faf6eb', colorTextSecondary: '#a6bdb3',
    colorBgLayout: '#102c2b', colorBgContainer: '#193a36', colorBgElevated: '#264c45',
    colorBorder: '#35564e', colorTextPlaceholder: '#a6bdb3', colorTextDisabled: '#a6bdb3',
  },
  components: {
    ...theme.components,
    Button: {
      ...theme.components?.Button, colorPrimary: '#e9c88d', colorPrimaryHover: '#f2d8a7', colorPrimaryActive: '#d7b675',
      defaultBg: '#264c45', defaultBorderColor: '#52766b',
      colorBgContainerDisabled: 'var(--theme-disabled)',
      borderColorDisabled: 'var(--theme-disabled-border)',
      colorTextDisabled: 'var(--theme-disabled-ink)',
      primaryColor: '#102c2b', colorPrimaryText: '#e9c88d', colorPrimaryTextHover: '#f2d8a7',
    },
  },
};

export function getLobbyTheme(mode: ThemeMode): ThemeConfig {
  return mode === 'dark' ? darkTheme : theme;
}
