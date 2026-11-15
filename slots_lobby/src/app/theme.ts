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
    ...theme.token, colorPrimary: '#00b24b', colorInfo: '#81b8ff', colorLink: '#81b8ff',
    colorSuccess: '#79e0ab', colorWarning: '#f2c477', colorError: '#ff9da8',
    colorText: '#f0f2f5', colorTextSecondary: '#a7aebb',
    colorBgLayout: '#141415', colorBgContainer: '#232428', colorBgElevated: '#2e3035',
    colorBorder: '#3a3c42', colorTextPlaceholder: '#a7aebb', colorTextDisabled: '#9a9eaa',
  },
  components: {
    ...theme.components,
    Button: {
      ...theme.components?.Button, colorPrimary: '#00b24b', colorPrimaryHover: '#25c565', colorPrimaryActive: '#00a346',
      defaultBg: '#2e3035', defaultBorderColor: '#666f7d',
      colorBgContainerDisabled: 'var(--theme-disabled)',
      borderColorDisabled: 'var(--theme-disabled-border)',
      colorTextDisabled: 'var(--theme-disabled-ink)',
      primaryColor: '#071d10', colorPrimaryText: '#69e398', colorPrimaryTextHover: '#86ecac',
    },
  },
};

export function getLobbyTheme(mode: ThemeMode): ThemeConfig {
  return mode === 'dark' ? darkTheme : theme;
}
