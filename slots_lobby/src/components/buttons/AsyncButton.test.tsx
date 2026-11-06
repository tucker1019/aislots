import {expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {AsyncButton,AsyncAntButton} from './AsyncButton';
it('请求中隐藏文字但保留占位，只展示转圈并禁止重复点击',()=>{
 const action=vi.fn();const {rerender}=render(<AsyncButton onClick={action}>领取</AsyncButton>);
 fireEvent.click(screen.getByRole('button',{name:'领取'}));expect(action).toHaveBeenCalledTimes(1);
 rerender(<AsyncButton loading onClick={action}>领取</AsyncButton>);
 const button=screen.getByRole('button',{name:'领取'});expect(button).toBeDisabled();expect(button).toHaveAttribute('aria-busy','true');expect(button.querySelector('.async-button-content')).toHaveStyle({visibility:'hidden'});expect(button.querySelector('.async-button-spinner')).not.toBeNull();fireEvent.click(button);expect(action).toHaveBeenCalledTimes(1);
 rerender(<AsyncButton disabled>已领取</AsyncButton>);expect(screen.getByRole('button',{name:'已领取'})).toBeDisabled();expect(document.querySelector('.async-button-spinner')).toBeNull();
});
it('Ant Design按钮不使用附加图标式loading，保留原内容布局',()=>{
 render(<AsyncAntButton loading>Save changes</AsyncAntButton>);expect(screen.getByRole('button',{name:'Save changes'})).toBeDisabled();expect(document.querySelector('.ant-btn-loading-icon')).toBeNull();expect(document.querySelectorAll('.async-button-spinner')).toHaveLength(1);
});
