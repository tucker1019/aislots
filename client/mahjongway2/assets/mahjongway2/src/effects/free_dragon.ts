import {Node} from 'cc';
import {EffectLibrary,NativeEffect} from './effect_library';
/** 原版免费龙装饰与开转演出；不改变服务端盘面。 */
export class FreeDragon {
    private decoration:NativeEffect;
    private dragon:NativeEffect;
    private tiles:NativeEffect;
    private mask:NativeEffect;
    private age=-1;
    private finish:(()=>void)|null=null;
    private tilesStarted=false;
    private savedOrder:Node[]=[];
    private center:Node|null=null;
    constructor(private parent:Node,private sound:()=>void,private stopSound:()=>void){
        this.center=parent.children.filter(node=>node.getComponent('slots_r'))[2]||null;
        // 装饰与飞龙属于 layout_center 层；遮罩与麻将飞行才属于转轴内部。
        const outer=parent.parent;
        this.decoration=EffectLibrary.create('ui_reel_bonus_dragon',outer);
        const offset=this.decoration.node.position.clone();
        this.decoration.node.setPosition(parent.position.x+offset.x,parent.position.y+offset.y,parent.position.z+offset.z);
        this.decoration.node.setSiblingIndex(parent.getSiblingIndex());
        this.dragon=EffectLibrary.create('dragon',outer);
        this.dragon.node.setPosition(parent.position);
        const artwork=outer.getChildByName('static_img');
        this.dragon.node.setSiblingIndex(artwork?artwork.getSiblingIndex()+1:parent.getSiblingIndex()+1);
        this.mask=EffectLibrary.create('dragon_mask',parent);
        this.tiles=EffectLibrary.create('mj_fly',parent);
    }
    visible(value:boolean){this.decoration.node.active=value;if(!value)this.cancel();}
    play(){
        this.cancel();this.savedOrder=this.parent.children.slice();this.age=0;this.tilesStarted=false;
        this.dragon.reset();this.dragon.node.setPosition(this.parent.position);this.dragon.play('dragon_free_start1');this.sound();
        return new Promise<void>(resolve=>{this.finish=resolve;});
    }
    update(dt:number){
        if(this.age<0)return;this.age+=dt;
        if(this.age>=0.8&&!this.mask.node.active){
            this.mask.node.active=true;
            // 原版：5、4、2、1、龙遮罩、3、麻将飞行。
            const order=['r5','r4','r2','r1'].map(name=>this.parent.getChildByName(name)).filter(Boolean);
            order.push(this.mask.node);
            if(this.center)order.push(this.center);
            order.push(this.tiles.node);
            order.forEach(node=>node.setSiblingIndex(this.parent.children.length-1));
        }
        if(this.age>=1.3&&!this.tilesStarted){this.tilesStarted=true;this.tiles.reset();this.tiles.play('dragon_free_start2');}
        if(this.age>=2.3)this.cancel();
    }
    cancel(){this.age=-1;this.dragon.hide();this.tiles.hide();this.mask.hide();this.savedOrder.forEach((node,index)=>{if(node.isValid)node.setSiblingIndex(index);});this.savedOrder=[];this.stopSound();const finish=this.finish;this.finish=null;finish?.();}
    destroy(){this.cancel();for(const effect of [this.decoration,this.dragon,this.tiles,this.mask])effect.destroy();}
}
