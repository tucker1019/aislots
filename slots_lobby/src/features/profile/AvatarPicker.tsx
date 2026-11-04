import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Alert,Button,Modal} from 'antd';
import {updateAccountAvatar} from '../../services/account';
import {useProfileUpdate} from './useProfileUpdate';
import {t} from '../../i18n';
export function AvatarPicker({uid,current,onClose}:{uid:number;current:number;onClose:()=>void}){
 const [selected,setSelected]=useState(current);const update=useProfileUpdate();
 const save=useMutation({mutationFn:()=>updateAccountAvatar(selected),retry:false,onSuccess:async profile=>{await update(uid,profile);onClose();}});
 return <Modal open centered title={t('profile.chooseAvatar')} width={360} closable={!save.isPending} mask={{closable:!save.isPending}} keyboard={!save.isPending} onCancel={onClose} footer={<Button autoInsertSpace={false} type="primary" className="profile-save" disabled={save.isPending||selected===current} loading={save.isPending} onClick={()=>save.mutate()}>{t('profile.save')}</Button>}>
 <div className="profile-avatars" role="group" aria-label={t('profile.chooseAvatar')}>{Array.from({length:15},(_,i)=>i+1).map(id=><button type="button" key={id} aria-label={t('profile.avatarNumber',{id})} aria-pressed={selected===id} disabled={save.isPending} onClick={()=>setSelected(id)}><img src={`/assets/profile/avatar/${id}.png`} alt=""/></button>)}</div>
 {save.isError&&<Alert type="error" showIcon title={save.error.message}/>}
 </Modal>;
}
