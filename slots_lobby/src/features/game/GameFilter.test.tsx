import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {GameFilter} from './GameFilter';
it('页内展开选择，选择后和Escape收起',()=>{const change=vi.fn();render(<GameFilter label="时间" value="hour" options={[{value:'hour',label:'1小时'},{value:'day',label:'24小时'}]} onChange={change}/>);fireEvent.click(screen.getByRole('button',{name:'时间'}));expect(screen.getByRole('listbox')).toBeInTheDocument();fireEvent.click(screen.getByRole('option',{name:'24小时'}));expect(change).toHaveBeenCalledWith('day');expect(screen.queryByRole('listbox')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'时间'}));fireEvent.keyDown(screen.getByRole('button',{name:'时间'}),{key:'Escape'});expect(screen.queryByRole('listbox')).not.toBeInTheDocument();});
