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
    ...theme.token, borderRadius: 14, colorPrimary: '#9655ff', colorInfo: '#c7adff', colorLink: '#c7adff',
    colorSuccess: '#79e0ab', colorWarning: '#ffd15c', colorError: '#ff9da8',
    colorText: '#fff7ff', colorTextSecondary: '#d8c8ed',
    colorBgLayout: '#21103d', colorBgContainer: '#38205d', colorBgElevated: '#45296d',
    colorBorder: '#624383', colorTextPlaceholder: '#d8c8ed', colorTextDisabled: '#9a9eaa',
  },
  components: {
    ...theme.components,
    Button: {
      ...theme.components?.Button, colorPrimary: '#9655ff', colorPrimaryHover: '#a970ff', colorPrimaryActive: '#8040df',
      defaultBg: '#45296d', defaultBorderColor: '#896ba8',
      colorBgContainerDisabled: 'var(--theme-disabled)',
      borderColorDisabled: 'var(--theme-disabled-border)',
      colorTextDisabled: 'var(--theme-disabled-ink)',
      primaryColor: '#ffffff', colorPrimaryText: '#e1c3ff', colorPrimaryTextHover: '#efdcff',
    },
  },
};

export function getLobbyTheme(mode: ThemeMode): ThemeConfig {
  return mode === 'dark' ? darkTheme : theme;
}
