import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {GameTile} from './GameTile';

it('retains custom operator artwork and normal game navigation',()=>{
 const enter=vi.fn();render(<GameTile gameId="AG4" label="Custom Tiger" cover="https://cdn.example/custom.webp" onEnter={enter}/>);
 expect(screen.getByRole('button',{name:'Custom Tiger'}).querySelector('img')).toHaveAttribute('src','https://cdn.example/custom.webp');
 fireEvent.click(screen.getByRole('button',{name:'Custom Tiger'}));expect(enter).toHaveBeenCalledOnce();
});
it('uses redesigned bundled artwork and falls back to the original if unavailable',()=>{
 render(<GameTile gameId="AG4" label="Fortune Tiger" provider="AG" cover="/assets/lobby/games/1017.png" onEnter={()=>{}}/>);
 const button=screen.getByRole('button',{name:'Fortune Tiger'}),image=button.querySelector('img')!;
 expect(image).toHaveAttribute('src','/assets/lobby/covers/indonesia-v2/AG4.webp');
 expect(screen.getByText('Fortune Tiger')).toBeVisible();
 fireEvent.error(image);
 expect(button.querySelector('img')).toHaveAttribute('src','/assets/lobby/games/1017.png');
 expect(button).not.toHaveClass('game-tile--redesigned');
 fireEvent.load(button.querySelector('img')!);expect(button).toHaveAttribute('aria-busy','false');
});
