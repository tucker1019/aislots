import {betMoney} from '../bet-records/money';

interface Forecast {id:string;label:string;amount:number}
/** Shared rows let the tallest translated heading determine every column's height. */
export function RebateForecast({items,className=''}:{items:readonly Forecast[];className?:string}) {
 return <div className={`rebate-preview ${className}`}>
  <table style={{minWidth:items.length*78}}>
   <thead><tr>{items.map(item=><th key={item.id} scope="col">{item.label}</th>)}</tr></thead>
   <tbody><tr>{items.map(item=><td key={item.id}><strong>{betMoney(item.amount)}</strong></td>)}</tr></tbody>
  </table>
 </div>;
}
