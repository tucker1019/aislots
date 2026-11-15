class GameBridge {
  /** 承载游戏的iframe对象的bridgeWindow */
  static bridgeWindow = null;
  /** 事件 */
  static MAP_LISTENER = {};
  /**
   * 初始化 Bridge 传入iframe元素的bridgeWindow
   */
  static init(bridgeWindow) {
    GameBridge.bridgeWindow = bridgeWindow;
  }

  /**
   * 游戏 调用 我 事件监听
   */
  static on(cid = '', fn, once = false) {
    console.log("on====>",cid,fn,once)
    GameBridge.MAP_LISTENER[cid] = GameBridge.MAP_LISTENER[cid] || [];
    fn.once = once;
    GameBridge.MAP_LISTENER[cid].push(fn);
  }

  /**
   * 移除 游戏 调用 我 监听函数
   * 创建游戏调用Web平台的回调监听函数
   */
  static off(cid = '', fn) {
    if (!GameBridge.MAP_LISTENER[cid]) return;
    if (!fn) {
      GameBridge.MAP_LISTENER[cid] = [];
    } else {
      GameBridge.MAP_LISTENER[cid] = GameBridge.MAP_LISTENER[cid].filter(e => e !== fn);
    }
  }

  /**
   * 清空所有Bridge监听函数
   */
  static offAll() {
    GameBridge.MAP_LISTENER = {};
  }

  /**
   * 我 调用 游戏 or 游戏调用平台
   * 创建Web平台调用游戏的Bridge函数
   * @param isRetuen 是否有返回值
   */
  static call = (cid = '', params = {}, isRetuen) => new Promise(resolve => {
    if (!cid) throw new Error('cid is required');
    if (!GameBridge.bridgeWindow) throw new Error('GameBridge has not been initialized, please call GameBridge to initialize');
    console.log("call==>", cid, params, isRetuen)
    if (isRetuen) {
      // 超时处理
      const tid = setTimeout(() => {
        console.log("call111==>", cid, params, isRetuen)
        console.log(`${cid} Call timed out, please check if there is a return value`);
        resolve({});
      }, 1000 * 10);
      // 返回值
      const onReturn = (data) => {
        console.log("call222==>", cid, params, isRetuen)
        console.log('%cdata', 'color: yellow', data)
        clearTimeout(tid);
        resolve(data);
      }
      GameBridge.on(cid, onReturn, true);
      // 触发函数
      console.log("触发函数", cid, params)
      GameBridge.bridgeWindow?.postMessage(JSON.stringify({ cid, params }), '*');
    } else {
      // 触发函数
      GameBridge.bridgeWindow?.postMessage(JSON.stringify({ cid, params }), '*');
      resolve({});
    }
  });
  /**
   * 调用平台/游戏 有返回值
   * @param cid
   * @param data 参数
   * @returns
   */
  static callReturnedValue = (cid, data = {}) => GameBridge.call(cid, data, true);
  /**
   * 调用平台/游戏 没有返回
   * @param cid
   * @param data
   * @returns
   */
  static callNoReturnValue = (cid, data = {}) => GameBridge.call(cid, data, false);
}

/**
 * 游戏 调用 客户端
 */
window.addEventListener('message', (event) => {
  // console.log('%c接收游戏消息--->: ', 'color: yellow', event);
  // if (GameBridge.bridgeWindow === top) return;
  let data = event?.data;
  if (!data) return;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return;
    }
  }
  if (!data.cid || !GameBridge.MAP_LISTENER[data.cid]) return;
  let result;
  GameBridge.MAP_LISTENER[data.cid].forEach(fn => {
    result = fn(data.params || data.data);
  });
  // once 处理
  if (GameBridge.MAP_LISTENER[data.cid]) GameBridge.MAP_LISTENER[data.cid] = GameBridge.MAP_LISTENER[data.cid].filter(fn => !fn.once);
  // 返回值
  if (!result) return;
  if (result instanceof Promise) { // 处理Promise
    result.then(res => GameBridge.bridgeWindow.postMessage(JSON.stringify({ cid: data.cid, data: res }), '*'))
  } else {
    GameBridge.bridgeWindow.postMessage(JSON.stringify({ cid: data.cid, data: result }), '*')
  }
});

window['GameBridge'] = GameBridge;
export default GameBridge;