System.register("chunks:///_virtual/main",["./main.ts","./test.ts"],(function(){"use strict";return{setters:[null,null],execute:function(){}}}));

System.register("chunks:///_virtual/main.ts",["./rollupPluginModLoBabelHelpers.js","cc"],(function(e){"use strict";var n,t,o,r,a,c,s;return{setters:[function(e){n=e.inheritsLoose},function(e){t=e.cclegacy,o=e._decorator,r=e.setDisplayStats,a=e.assetManager,c=e.director,s=e.Component}],execute:function(){var i;t._RF.push({},"63677qeUdlKR6ZwA21G1s6X","main",void 0);var u=o.ccclass,l=(o.property,"szcw_1021fortuneleopard");e("main",u("main")(i=function(e){function t(){return e.apply(this,arguments)||this}n(t,e);var o=t.prototype;return o.start=function(){var e=this;console.log("load main scene"),r(!1),a.loadBundle(l,(function(n,t){e.enterGame()}))},o.enterGame=function(){a.getBundle(l).loadScene("game",(function(e,n){c.runScene(n)}))},t}(s))||i);t._RF.pop()}}}));

System.register("chunks:///_virtual/test.ts",["./rollupPluginModLoBabelHelpers.js","cc"],(function(t){"use strict";var e,n,o,r;return{setters:[function(t){e=t.inheritsLoose},function(t){n=t.cclegacy,o=t._decorator,r=t.Component}],execute:function(){var s;n._RF.push({},"4e21eeA4wdHKrmevXkD6e/d","test",void 0);var c=o.ccclass;o.property,t("test",c("test")(s=function(t){function n(){return t.apply(this,arguments)||this}e(n,t);var o=n.prototype;return o.onLoad=function(){},o.update=function(t){},n}(r))||s);n._RF.pop()}}}));

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});