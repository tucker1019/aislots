import { _decorator, Component, math, Node, ResolutionPolicy, UITransform, view } from 'cc';
import { WBSConfig } from '../cfg/WBSConfig';

const { ccclass, property } = _decorator;

@ccclass('WBSBgAdaptCtrl')
export class WBSBgAdaptCtrl extends Component {

    onLoad() {
        this.updateAlignment()
    }

    updateAlignment() {
        console.log("updateAlignment")
        let widSize: math.Size = view.getVisibleSizeInPixel(); // 获取窗口像素
        let design_resolution = view.getDesignResolutionSize();// 获取设计分辨率
        let bgUIransform = this.node.getComponent(UITransform).contentSize.clone(); // 获取节点大小
        //  这里一定要再   
        // let actual_size = view.getVisibleSizeInPixel();
        // let design_resolution = view.getDesignResolutionSize();
        // if (design_resolution.height / design_resolution.width >= actual_size.height / actual_size.width) FOXGlobal.ADAPTATION = ResolutionPolicy.FIXED_HEIGHT
        // else FOXGlobal.ADAPTATION = ResolutionPolicy.FIXED_WIDTH
        // view.setResolutionPolicy(FOXGlobal.ADAPTATION)
        // 之后调用

        if (WBSConfig.adaptation == ResolutionPolicy.FIXED_HEIGHT) {
            //  如果是按高适配， 
            let s = design_resolution.height / widSize.height; //算出按高适配等比缩放的比例
            widSize.height *= s; // 为什么要乘回去，因为我们的视图被按高等比缩放过，这个widSize 是实际相对窗口的大小，需要转成相对于我们设计分辨率的大小；
            widSize.width *= s;
        } else {
            //  如果是按宽适配， 
            let s = design_resolution.width / widSize.width //算出按宽适配等比缩放的比例
            widSize.height *= s;
            widSize.width *= s;
        }
        //取最大的比例 等比缩放铺满屏幕
        let scale = Math.max(widSize.width / bgUIransform.width, widSize.height / bgUIransform.height)

        console.log("widSize", JSON.stringify(widSize), bgUIransform.width, bgUIransform.height, scale)
        this.node.setScale(scale, scale);
    }

}

