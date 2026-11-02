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
    Segmented: { trackBg: '#f5f5f7', itemSelectedBg: '#ffffff', itemSelectedColor: '#1d1d1f', trackPadding: 4 },
    Input: { activeShadow: '0 0 0 3px rgb(0 113 227 / 12%)' },
    Modal: { titleFontSize: 23, titleLineHeight: 1.4, borderRadiusLG: 20 },
  },
};
