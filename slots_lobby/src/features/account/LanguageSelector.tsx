import { overlayContainer } from '../../app/designViewport';
import { languages, isLocale } from '../../i18n/config';
import { useState } from 'react';
import { Modal, Radio } from 'antd';
import { t, useLanguageStore } from '../../i18n';
import { Icon } from '../../components/Icon';
export function LanguageSelector(){
 const [open,setOpen]=useState(false);
 const locale=useLanguageStore(state=>state.locale);
 const setLocale=useLanguageStore(state=>state.setLocale);
 const options=languages.map(item=>({value:item.id,label:t(item.labelKey)}));
 return <><button type="button" onClick={()=>setOpen(true)} aria-label={t('language.choose')}><span className="account-help-icon" aria-hidden="true"><Icon name="info" size={17}/></span><span>{t('language.title')}</span><span className="account-language-current">{options.find(row=>row.value===locale)?.label}</span><span aria-hidden="true"><Icon name="chevron" size={16}/></span></button><Modal getContainer={overlayContainer} title={t('language.choose')} open={open} footer={null} width={350} centered onCancel={()=>setOpen(false)}><Radio.Group className="language-options" value={locale} onChange={event=>{const value:unknown=event.target.value;if(isLocale(value)){setLocale(value);setOpen(false);}}} options={options}/></Modal></>;
}
