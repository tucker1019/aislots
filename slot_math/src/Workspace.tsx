import { useEffect, useState } from 'react';
import { App } from './App';
import { DeveloperPage } from './components/DeveloperPage';
import { GameWorkspaceProvider } from './state/GameWorkspace';
const currentPage = () => location.hash === '#/developer' ? 'developer' : 'analysis';
export function Workspace() {
  const [page,setPage]=useState(currentPage);
  const [visited,setVisited]=useState(page==='developer');
  useEffect(()=>{const change=()=>{const next=currentPage();setPage(next);if(next==='developer')setVisited(true);};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  return <GameWorkspaceProvider><div hidden={page==='developer'}><App /></div>{visited&&<div hidden={page!=='developer'}><DeveloperPage active={page==='developer'} /></div>}</GameWorkspaceProvider>;
}
