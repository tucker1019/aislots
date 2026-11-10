import {Drawer} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {getLocale,t} from '../../i18n';
import {isRecord} from '../account/types';
import {betMoney} from '../bet-records/money';

interface TurnoverItem {
 source:string;
 amount:number;
 required:number;
 completed:number;
 createdAt:string;
}

const sourceLabels = {
 rch_001:'copy.deposit', rch_002:'withdrawal.turnoverDepositReward',
 act_001:'copy.checkIn', act_002:'copy.dailyRebate', act_003:'copy.weeklyRebate',
 act_004:'copy.monthlyRebate', act_005:'loss.title', vip_001:'copy.vipBenefits', vip_002:'copy.vipBenefits', vip_003:'copy.vipBenefits', act_007:'copy.inviteFriends',
} as const;

function isMoney(value:unknown):value is number {
 return typeof value==='number' && Number.isSafeInteger(value) && value>=0;
}

function isTurnoverItem(value:unknown):value is TurnoverItem {
 return isRecord(value) && typeof value.source==='string' && isMoney(value.amount) &&
  isMoney(value.required) && value.required>0 && isMoney(value.completed) &&
  value.completed<=value.required && typeof value.createdAt==='string' &&
  Number.isFinite(Date.parse(value.createdAt));
}

export function WithdrawalTurnoverDetails({response,onClose}:{
 response:Record<string,unknown>|null;
 onClose:()=>void;
}) {
 const remaining=response?.remainingTurnover;
 const rows=response?.turnoverItems;
 const items=Array.isArray(rows)&&rows.length>0&&rows.every(isTurnoverItem)&&
  rows.reduce((sum,row)=>sum+row.required-row.completed,0)===remaining ? rows : [];
 return <Drawer open={!!response} placement="bottom" size="auto" destroyOnHidden
  title={t('withdrawal.turnoverDetails')} onClose={onClose}
  getContainer={overlayContainer} rootStyle={{position:'absolute',pointerEvents:response?'auto':'none'}} className="withdrawal-turnover-sheet">
  {isMoney(remaining) && remaining>0 ? <>
   <dl className="withdrawal-turnover-summary">
    {items.length>0&&<div><dt>{t('withdrawal.turnoverTotal')}</dt><dd>{betMoney(items.reduce((sum,row)=>sum+row.required,0))}</dd></div>}
    <div><dt>{t('withdrawal.turnoverRemaining')}</dt><dd>{betMoney(remaining)}</dd></div>
   </dl>
   {items.map((item,index)=><article className="withdrawal-turnover-item" key={index}>
    <header><strong>{t(sourceLabels[item.source as keyof typeof sourceLabels]??'withdrawal.turnoverCredit')}</strong><b>{betMoney(item.amount)}</b></header>
    <dl>
     <div><dt>{t('withdrawal.turnoverTotal')}</dt><dd>{betMoney(item.required)}</dd></div>
     <div><dt>{t('withdrawal.turnoverCompleted')}</dt><dd>{betMoney(item.completed)}</dd></div>
     <div><dt>{t('withdrawal.turnoverCreditTime')}</dt><dd><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(getLocale())}</time></dd></div>
    </dl>
   </article>)}
  </>:<p>{t('withdrawal.requestFailed')}</p>}
 </Drawer>;
}
