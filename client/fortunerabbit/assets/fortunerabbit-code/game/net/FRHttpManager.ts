import { FRPlatformMgr } from "../3rd/FRPlatformMgr";
import { FRConstant } from "../FRConstant/FRConstant";
import { FRGlobal } from "../view/layer/FRGlobal";

export class FRHttpManager {
    /**
     * GET访问
     * @param api 地址
     * @param params 参数
     * @param cb 回调
     * @param target 上下文
     * @returns
     */
    public static sendError() {

        let time = 8000;
        var xhr = new XMLHttpRequest();
        xhr.timeout = time;
        var isTimeout = false;//是否超时
        var timeoutTimer = setTimeout(function () {
            isTimeout = true;
            xhr.abort();//请求中止
            console.log(`【HTTP】 ontimeout <====  ${Math.floor(Date.now() / 1000)}`);


        }, time);
        xhr.onreadystatechange = () => {
            let ret = null;
            if (xhr.readyState == 4) {
                if (isTimeout) return;//请求已经超时，忽略中止请求
                clearTimeout(timeoutTimer);//取消等待的超时
                if (xhr.status >= 200 && xhr.status < 400) {


                    ret = xhr.response;

                }
            }
        };
        xhr.onerror = function (event) {

            xhr.abort();//请求中止
            clearTimeout(timeoutTimer);
        };


        let formal = FRPlatformMgr.isLineEnv() ? 1 : 2
        let url = "https://admin-singlab.chaowanpd.com//addons/apiservice/platformlog/add_point?game_id=" + FRConstant.GAMEID + "&code=8&formal=" + formal + "&uid=" + FRGlobal.USER.uid


        console.log(`【HTTP】 get ====> ${url}`);
        xhr.open("GET", url, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(null);

    }

}

