import { DocumentFields } from './DocumentFields';
import { useState } from 'react';
import { afterEach,beforeAll,expect,it,vi } from 'vitest';
import { cleanup,render,screen,fireEvent } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { ExperienceGameWeights } from './ExperienceGameWeights';
import type { Json } from '../services/schema';
vi.mock('../services/configs',()=>({getConfig:vi.fn().mockResolvedValue({published:{games:{AG1:{name:'One',enabled:true,apiUrl:'http://one/',sort:1},AG2:{name:'Two',enabled:true,apiUrl:'http://two/',sort:2},CLOSED:{name:'Closed',enabled:false,apiUrl:'http://closed/',sort:3}}}})}));
beforeAll(()=>{globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};Object.defineProperty(window,'matchMedia',{writable:true,value:vi.fn().mockImplementation(()=>({matches:false,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()}))});});
afterEach(cleanup);
function Fixture(){const [value,setValue]=useState<Record<string,Json>>({AG1:3,AG2:1,CLOSED:999});return <><ExperienceGameWeights value={value} disabled={false} onChange={next=>setValue(next as Record<string,Json>)}/><output data-testid="value">{JSON.stringify(value)}</output></>;}
it('shows weighted shares only for online games and edits weights',async()=>{
 render(<QueryClientProvider client={new QueryClient()}><Fixture/></QueryClientProvider>);
 expect(await screen.findByText('75.0%')).not.toBeNull();
 expect(screen.queryByLabelText('体验游戏权重 CLOSED')).toBeNull();
 expect(screen.queryByText('Closed')).toBeNull();expect(screen.getByText('25.0%')).not.toBeNull();
 fireEvent.change(screen.getByLabelText('体验游戏权重 AG2'),{target:{value:'3'}});
 expect(screen.getAllByText('50.0%')).toHaveLength(2);expect(JSON.parse(screen.getByTestId('value').textContent??'{}')).toMatchObject({AG2:3,CLOSED:999});
});

function StopFixture(){const [value,setValue]=useState<Json>({enabled:false,createMinSeconds:30,createMaxSeconds:120,playMinSeconds:10,playMaxSeconds:30});return <><DocumentFields path="experience" value={value} onChange={setValue}/><output data-testid="settings">{JSON.stringify(value)}</output></>;}
it('edits both stop settings and game weights while preserving the existing enable flag',async()=>{
 render(<QueryClientProvider client={new QueryClient()}><StopFixture/></QueryClientProvider>);
 expect((screen.getByLabelText('experience.stopEveryRounds') as HTMLInputElement).value).toBe('50');
 expect((screen.getByLabelText('experience.stopChancePercent') as HTMLInputElement).value).toBe('20');
 fireEvent.change(screen.getByLabelText('experience.stopEveryRounds'),{target:{value:'70'}});
 fireEvent.change(screen.getByLabelText('experience.stopChancePercent'),{target:{value:'25'}});
 fireEvent.change(await screen.findByLabelText('体验游戏权重 AG2'),{target:{value:'1'}});
 expect(JSON.parse(screen.getByTestId('settings').textContent??'{}')).toMatchObject({enabled:false,stopEveryRounds:70,stopChancePercent:25,gameWeights:{AG1:1,AG2:1}});
});
