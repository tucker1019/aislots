const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../preview-template/preview-cover.js'),'utf8');
function fixture(scene = null) {
    const listeners = new Map(), events = new Map();
    let removed = 0;
    const director = {getScene:()=>scene,once:(name,fn)=>events.set(name,fn)};
    vm.runInNewContext(source, {
        document:{getElementById:()=>({remove:()=>removed++})},
        window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},
        System:{import:async()=>({director,Director:{EVENT_AFTER_DRAW:'draw',EVENT_AFTER_SCENE_LAUNCH:'scene'}})},
        console,
    });
    return {listeners,events,removed:()=>removed};
}
test('cover waits for server board initialization and its first draw', async () => {
    const f=fixture();
    f.listeners.get('load')(); await Promise.resolve();
    assert.equal(f.removed(),0);
    assert.equal(f.events.has('draw'),false);
    f.listeners.get('aislots-board-ready')();
    assert.equal(f.removed(),0);
    f.events.get('draw')();
    assert.equal(f.removed(),1);
});
test('fast state response is retained before engine loads; errors reveal diagnostics', async () => {
    const f=fixture();
    f.listeners.get('aislots-board-ready')();
    assert.equal(f.events.has('draw'),false);
    f.listeners.get('load')(); await Promise.resolve();
    assert.equal(f.removed(),0);
    f.listeners.get('error')(); f.events.get('draw')();
    assert.equal(f.removed(),1);
});
