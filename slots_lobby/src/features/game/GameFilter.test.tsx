import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {GameFilter} from './GameFilter';
it('頁內展開選擇，選擇後和Escape收起',()=>{const change=vi.fn();render(<GameFilter label="時間" value="hour" options={[{value:'hour',label:'1小時'},{value:'day',label:'24小時'}]} onChange={change}/>);fireEvent.click(screen.getByRole('button',{name:'時間'}));expect(screen.getByRole('listbox')).toBeInTheDocument();fireEvent.click(screen.getByRole('option',{name:'24小時'}));expect(change).toHaveBeenCalledWith('day');expect(screen.queryByRole('listbox')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'時間'}));fireEvent.keyDown(screen.getByRole('button',{name:'時間'}),{key:'Escape'});expect(screen.queryByRole('listbox')).not.toBeInTheDocument();});
