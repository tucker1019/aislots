import { _decorator, js, Label, tween, Tween, } from 'cc';
import { consoleLogError, showMoney } from '../../xtools/WBSUtils';

const { ccclass, property } = _decorator;
type BindTarget = {
    num: number
}
@ccclass('RollNumLabel')
export class RollNumLabel extends Label {
    private _num: number = 0;
    private _tween: Tween<BindTarget> = null;

    /**
     * 
     * @param number
     */
    setString(number: number) {
        this._tween && this._tween.stop();
        this.string = showMoney(number)
        if (isNaN(number))
            consoleLogError(`${js.getClassName(this)}/setString NaN`)
        else if (number < 0)
            consoleLogError(`${js.getClassName(this)}/setString <0`)
        else
            this._num = number;
    }

    setAniString(number: number, rollTime: number = 0.2) {
        this._tween && this._tween.stop();
        this.string = showMoney(this._num)
        if (isNaN(number))
            consoleLogError(`${js.getClassName(this)}/setString NaN`)
        else if (number < 0)
            consoleLogError(`${js.getClassName(this)}/setString <0`)
        let bindTarget: BindTarget = { num: this._num }
        this._tween = tween(bindTarget).to(rollTime, { num: number }, {
            onUpdate: (target: BindTarget) => {
                this.string = showMoney((target.num ))
            }
        }).call(() => this.string = showMoney(number))
        this._tween.start();
        this._num = number
    }
}

