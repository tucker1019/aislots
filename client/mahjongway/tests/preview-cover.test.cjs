const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../preview-template/preview-cover.js'),'utf8');
function fixture(scene = null) {
    const listeners = new Map(), events = new Map();
    const buttonListeners = new Map();
    let removed = 0;
    const cover = {remove:()=>removed++};
    const progress = {value:'0',getAttribute:()=>progress.value,setAttribute:(name,value)=>{progress.value=value}};
    const fill = {style:{}};
    const button = {hidden:true,addEventListener:(name,fn)=>buttonListeners.set(name,fn)};
    const director = {getScene:()=>scene,once:(name,fn)=>events.set(name,fn)};
    vm.runInNewContext(source, {
        document:{getElementById:id=>id==='PreviewStartButton'?button:cover,querySelector:selector=>selector==='.preview-loading'?progress:fill},
        window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),dispatchEvent:()=>{}},
        Event:function(name){this.type=name},
        System:{import:async()=>({director,Director:{EVENT_AFTER_DRAW:'draw',EVENT_AFTER_SCENE_LAUNCH:'scene'}})},
        console,
    });
    return {listeners,events,buttonListeners,button,progress,fill,removed:()=>removed};
}
test('preview shows START after board initialization and waits for a draw after click', async () => {
    const f=fixture();
    f.listeners.get('load')(); await Promise.resolve();
    assert.equal(f.removed(),0);
    assert.equal(f.events.has('draw'),false);
    f.listeners.get('aislots-board-ready')();
    assert.equal(f.removed(),0);
    assert.equal(f.button.hidden,false);
    assert.equal(f.progress.value,'100');
    f.buttonListeners.get('click')();
    assert.equal(f.removed(),0);
    assert.equal(f.events.has('draw'),true);
    f.events.get('draw')();
    assert.equal(f.removed(),1);
});
test('fast state response is retained before engine loads; errors reveal diagnostics', async () => {
    const f=fixture();
    f.listeners.get('aislots-board-ready')();
    assert.equal(f.events.has('draw'),false);
    f.listeners.get('load')(); await Promise.resolve();
    assert.equal(f.removed(),0);
    f.listeners.get('error')();
    assert.equal(f.removed(),1);
});
