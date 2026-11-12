import { useQuery } from '@tanstack/react-query';
import { getConfigs } from '../services/configs';
import { useConsole } from './session';

export function useConfigSelection() {
 const key = useConsole(s => s.configKey);
 const query = useQuery({ queryKey: ['configs'], queryFn: getConfigs });
 const selected = query.data?.find(config => config.key === key) ?? query.data?.[0];
 return { query, selected };
}
