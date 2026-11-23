import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Checkbox, Input, Modal, Table, Tag, message } from 'antd';
import { createRedeemCode, getRedeemCodes, type RedeemCode } from '../services/admin';
import { date, money } from '../services/format';
import { useCursor } from '../features/useCursor';
import { useConsole } from '../features/session';
import { AsyncButton } from '../components/AsyncButton';
import { QueryState } from '../components/QueryState';
import { LoadMore } from '../components/LoadMore';
import { Page } from '../components/Page';

export function RedeemCodes() {
 const [uid,setUid]=useState(''); const [amount,setAmount]=useState(''); const [turnover,setTurnover]=useState(true); const [reason,setReason]=useState(''); const [queryText,setQueryText]=useState(''); const [issued,setIssued]=useState<string|null>(null);
 const role=useConsole(s=>s.session?.role); const client=useQueryClient();
 const query=useCursor(['redeem-codes',queryText],cursor=>getRedeemCodes(queryText,cursor));
 const generate=useMutation({mutationFn:()=>createRedeemCode({uid:uid.trim(),amount:amount.trim(),turnover,reason:reason.trim()}),onSuccess:async result=>{setIssued(result.code);setUid('');setAmount('');setReason('');await Promise.all([client.invalidateQueries({queryKey:['redeem-codes']}),client.invalidateQueries({queryKey:['audit']})]);}});
 const validUid=/^[1-9]\d{0,18}$/.test(uid.trim()); const validAmount=/^[1-9]\d{0,17}$/.test(amount.trim());
 async function copyCode(){if(!issued)return;try{await navigator.clipboard.writeText(issued);void message.success('兑换码已复制');}catch{void message.error('复制失败，请手动选择兑换码');}}
 return <Page eyebrow="MEMBER BENEFITS" title="兑换码" description="为指定会员生成一次性兑换码，金币入账和资金流水在同一事务中完成。" filters={<div className="filter-row"><Input.Search aria-label="搜索兑换码记录" allowClear placeholder="兑换码记录 ID / 会员 UID" onSearch={setQueryText}/><AsyncButton loading={query.isRefetching&&!query.isFetchingNextPage} onClick={()=>void query.refetch()}>刷新</AsyncButton></div>}>
  {role==='admin'&&<div className="panel redeem-code-form"><h2>生成兑换码</h2><div className="filter-row"><label className="field-label">会员 UID<Input inputMode="numeric" value={uid} onChange={e=>setUid(e.target.value)} placeholder="输入接收兑换码的 UID" maxLength={19}/></label><label className="field-label">金币数量（分）<Input inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.replace(/\D/g,''))} placeholder="输入整数金币数量" maxLength={18}/></label></div><Checkbox checked={turnover} onChange={e=>setTurnover(e.target.checked)}>需要打流水（1 倍）</Checkbox><label className="field-label">生成原因<Input.TextArea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={2} placeholder="填写发放原因，记录在后台审计日志"/></label>{generate.error&&<p role="alert">{generate.error.message}</p>}<AsyncButton type="primary" className="primary-action" loading={generate.isPending} disabled={!validUid||!validAmount||!reason.trim()} onClick={()=>{if(!generate.isPending&&validUid&&validAmount&&reason.trim())generate.mutate();}}>生成兑换码</AsyncButton></div>}
  <div className="panel"><QueryState pending={query.isPending} error={query.isFetchNextPageError?null:query.error} retry={()=>void query.refetch()}/>{!query.isPending&&<Table<RedeemCode> rowKey="id" dataSource={query.items} pagination={false} scroll={{x:1000}} columns={[{title:'记录 / 会员',key:'member',render:(_,r)=><><strong>{r.id}</strong><small>UID {r.uid}</small></>},{title:'金币数量',dataIndex:'amount',align:'right',render:money},{title:'流水要求',dataIndex:'turnover',render:v=>v?<Tag color="blue">1 倍</Tag>:'免流水'},{title:'状态',dataIndex:'status',render:v=><Tag color={v==='redeemed'?'green':'orange'}>{v==='redeemed'?'已兑换':'未兑换'}</Tag>},{title:'操作人',dataIndex:'createdBy'},{title:'生成时间',dataIndex:'createdAt',render:date},{title:'兑换时间',dataIndex:'redeemedAt',render:(v:string|undefined)=>v?date(v):'—'}]}/>}<LoadMore hasMore={Boolean(query.hasNextPage)} loading={query.isFetchingNextPage} error={query.isFetchNextPageError} onLoad={()=>void query.fetchNextPage()}/></div>
  <Modal open={Boolean(issued)} title="兑换码已生成" onCancel={()=>setIssued(null)} footer={<><AsyncButton onClick={()=>setIssued(null)}>关闭</AsyncButton><AsyncButton type="primary" className="primary-action" onClick={()=>void copyCode()}>复制兑换码</AsyncButton></>}><p>请将此兑换码提供给指定会员。出于安全考虑，兑换码只在生成时显示一次。</p><Input readOnly value={issued??''} onFocus={event=>event.target.select()}/></Modal>
 </Page>;
}
