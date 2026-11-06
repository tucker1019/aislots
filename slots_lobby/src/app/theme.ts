import {theme as antTheme} from 'antd';
import type {ThemeMode} from '../stores/theme';
import type { ThemeConfig } from 'antd';
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#0066cc', colorInfo: '#0066cc', colorText: '#1d1d1f',
    colorTextSecondary: '#6e6e73', colorBgLayout: '#ffffff', colorBorder: '#e5e5e8',
    colorBgContainer: '#ffffff', borderRadius: 10, fontSize: 15,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    controlHeight: 42, colorLink: '#0066cc', boxShadow: 'none',
  },
  components: {
    Button: { primaryShadow: 'none', borderRadius: 999, fontWeight: 400 },
  },
};

const darkTheme:ThemeConfig={...theme,algorithm:antTheme.darkAlgorithm,token:{...theme.token,colorPrimary:'#6aabff',colorInfo:'#6aabff',colorLink:'#8abeff',colorText:'#e6edf6',colorTextSecondary:'#a0aec0',colorBgLayout:'#111923',colorBgContainer:'#1a2533',colorBgElevated:'#202d3d',colorBorder:'#35465c',colorTextPlaceholder:'#9aa9bb',colorTextDisabled:'#8594a6'},components:{...theme.components,Button:{...theme.components?.Button,colorPrimary:'#1769c4',colorPrimaryHover:'#267de1',colorPrimaryActive:'#1256a3'}}};
export function getLobbyTheme(mode:ThemeMode):ThemeConfig{return mode==='dark'?darkTheme:theme;}
