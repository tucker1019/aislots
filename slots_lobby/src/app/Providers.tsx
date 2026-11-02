import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: 1, retryDelay: 500, refetchOnWindowFocus: false },
  } }));
  return <ConfigProvider locale={zhCN} theme={theme}><QueryClientProvider client={client}>{children}</QueryClientProvider></ConfigProvider>;
}
