import { useQuery } from '@tanstack/react-query';
import { InputNumber, Table, Tag } from 'antd';
import { getConfig } from '../services/configs';
import type { Json } from '../services/schema';
import { QueryState } from '../components/QueryState';
interface Props { value: Record<string, Json>; onChange: (value: Json) => void; disabled: boolean }
interface Row { id: string; name: string; online: boolean; ready: boolean; sort: number; weight: number }
export function ExperienceGameWeights({value,onChange,disabled}:Props){
 const query=useQuery({queryKey:['config','games'],queryFn:()=>getConfig('games'),staleTime:0});
 const published=query.data?.published;
 const catalog=published && typeof published==='object' && !Array.isArray(published) ? published.games : undefined;
 const games=catalog && typeof catalog==='object' && !Array.isArray(catalog) ? catalog : {};
 const ids=new Set([...Object.keys(games),...Object.keys(value)]);
 const rows:Row[]=[...ids].map(id=>{
  const raw=games[id];const game=raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {};
  const online=game.enabled===true;
  return{id,name:typeof game.name==='string'?game.name:id,online,ready:online && typeof game.apiUrl==='string' && !!game.apiUrl,sort:typeof game.sort==='number'?game.sort:2147483647,weight:typeof value[id]==='number'?value[id]:0};
 }).filter(row=>row.online).sort((a,b)=>a.sort-b.sort||a.id.localeCompare(b.id));
 const total=rows.reduce((sum,row)=>sum+(row.ready?row.weight:0),0);
 return <div>
  <p>仅已上线且游戏 API 已配置的游戏参与分配；权重 0 不参与。权重只影响新建账号，账号创建后固定游戏。修改后保存草稿并发布。</p>
  <QueryState pending={query.isPending} error={query.error} retry={()=>void query.refetch()}/>
  {!query.isPending && !query.isError && total===0 && <p role="status">没有可分配的游戏，新建体验账号将暂停；已有账号继续按原游戏执行。</p>}
  <Table<Row> size="small" rowKey="id" dataSource={rows} pagination={{pageSize:10,showSizeChanger:false}} columns={[
   {title:'游戏',key:'game',render:(_,row)=><div><strong>{row.name}</strong><div>{row.id}</div></div>},
   {title:'状态',key:'state',render:(_,row)=><Tag color={row.ready?'green':'default'}>{row.ready?'已上线':row.online?'未配置 API':'未上线'}</Tag>},
   {title:'分配权重',key:'weight',render:(_,row)=><InputNumber aria-label={`体验游戏权重 ${row.id}`} min={0} max={1000000000} precision={0} value={row.weight} disabled={disabled} onChange={weight=>{if(weight!==null)onChange({...value,[row.id]:weight});}}/>},
   {title:'预计比例',key:'ratio',render:(_,row)=>row.ready&&total>0?`${(row.weight/total*100).toFixed(1)}%`:'0%'},
  ]}/>
 </div>;
}
