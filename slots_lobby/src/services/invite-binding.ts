const storageKey='aislots-pending-invite';
function removeParameter(){const url=new URL(window.location.href);if(url.searchParams.has('inviteCode')){url.searchParams.delete('inviteCode');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);}}
export function clearInviteCode(){try{sessionStorage.removeItem(storageKey);}catch{/* Optional browser storage. */}removeParameter();}
export function pendingInviteCode(hasIdentity:boolean):string|undefined{
 if(hasIdentity){clearInviteCode();return undefined;}
 const code=new URL(window.location.href).searchParams.get('inviteCode');
 if(code&&/^[A-Za-z0-9_-]{1,64}$/.test(code)){try{sessionStorage.setItem(storageKey,code);}catch{/* URL remains available until creation succeeds. */}return code;}
 try{const saved=sessionStorage.getItem(storageKey);return saved&&/^[A-Za-z0-9_-]{1,64}$/.test(saved)?saved:undefined;}catch{return undefined;}
}
