import {useId,useState} from 'react';
import {t} from '../../i18n';
interface Filter {
  id:string; label:string; value:string;
  options:{value:string;label:string}[];
  onChange:(value:string)=>void;
}
/** Shared record filter appearance: inline triggers and a full-width option panel. */
export function RecordFilterBar({filters}:{filters:Filter[]}) {
  const [panel,setPanel]=useState<string|null>(null);
  const panelId=useId();
  const active=filters.find(filter=>filter.id===panel);
  return <div className="cash-filter-container" onKeyDown={event=>{if(event.key==='Escape')setPanel(null);}}>
    <div className="cash-filter-bar">{filters.map(filter=><button key={filter.id} type="button" aria-label={filter.label} aria-expanded={panel===filter.id} aria-controls={panelId} onClick={()=>setPanel(panel===filter.id?null:filter.id)}>
      {filter.options.find(option=>option.value===filter.value)?.label??filter.label}<span aria-hidden="true">{panel===filter.id?'▴':'▾'}</span>
    </button>)}</div>
    {active&&<>
      <button className="cash-filter-backdrop" type="button" aria-label={t('copy.closeFilters')} onClick={()=>setPanel(null)}/>
      <div className="cash-filter-options" id={panelId} aria-label={active.label}>{active.options.map(option=><button type="button" key={option.value} aria-pressed={option.value===active.value} onClick={()=>{active.onChange(option.value);setPanel(null);}}>{option.label}</button>)}</div>
    </>}
  </div>;
}
