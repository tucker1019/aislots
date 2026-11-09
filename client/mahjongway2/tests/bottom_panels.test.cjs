const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../../../slot_math/node_modules/typescript');
require.extensions['.ts'] = (module, file) =>
    module._compile(
        ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                experimentalDecorators: true,
            },
        }).outputText,
        file,
    );
const original = Module._load;
Module._load = function (id, ...args) {
    if (id === 'cc')
        return {
            Component: class {},
            Node: class {},
            _decorator: { ccclass: () => (c) => c, property: () => {} },
        };
    return original.call(this, id, ...args);
};
const { BottomPanelTransition } = require('../assets/mahjongway/src/slots/bottom_panels.ts');
function fixture() {
    const node = () => ({
        active: true,
        position: { x: 7, y: -111, z: 0 },
        setPosition(x, y, z) {
            this.position = { x, y, z };
        },
    });
    const panel1 = node(),
        panel2 = node(),
        pending = [];
    const controller = new BottomPanelTransition(
        panel1,
        panel2,
        (target, position, duration, done) => pending.push({ target, position, duration, done }),
    );
    const advance = () => {
        const step = pending.shift();
        step.target.setPosition(step.position.x, step.position.y, step.position.z);
        step.done();
        return step;
    };
    return { panel1, panel2, pending, controller, advance };
}
test('menu hides panel1 before panel2 enters; close reverses without position drift', () => {
    const f = fixture();
    assert.equal(f.panel1.active, true);
    assert.equal(f.panel2.active, false);
    f.controller.show(2);
    assert.equal(f.pending.length, 1);
    assert.equal(f.panel2.active, false);
    const out = f.advance();
    assert.equal(out.duration, 0.08);
    assert.equal(out.position.y, -320);
    assert.equal(f.panel1.active, false);
    assert.equal(f.panel2.active, true);
    assert.equal(f.panel2.position.y, -320);
    f.advance();
    assert.equal(f.panel2.position.y, -111);
    f.controller.show(1);
    f.advance();
    f.advance();
    assert.equal(f.panel1.active, true);
    assert.equal(f.panel2.active, false);
    assert.deepEqual(f.panel1.position, { x: 7, y: -111, z: 0 });
});
test('repeated clicks cannot queue competing panel transitions', () => {
    const f = fixture();
    f.controller.show(2);
    f.controller.show(2);
    f.controller.show(1);
    assert.equal(f.pending.length, 1);
    f.advance();
    f.controller.show(1);
    assert.equal(f.pending.length, 1);
    f.advance();
    assert.equal(f.panel2.active, true);
    assert.equal(f.pending.length, 0);
    f.controller.show(2);
    assert.equal(f.pending.length, 0);
});
test('destroyed panel controller ignores pending animation callbacks', () => {
    const f = fixture();
    f.controller.show(2);
    f.controller.dispose();
    f.advance();
    assert.equal(f.panel2.active, false);
    assert.equal(f.pending.length, 0);
});

test('scene panels retain current spin handlers and contain no source-project menu business callbacks', () => {
 const scene=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/mahjongway/mahjongway.scene'),'utf8'));
 const game=scene.find(n=>n.__type__==='cc.Node'&&n._name==='GameLayer');
 assert.ok(game);
 const child=(node,name)=>node._children.map(r=>scene[r.__id__]).find(n=>n._name===name);
 const layout=child(game,'layout_bottom');assert.ok(layout);
 const panel1=child(layout,'panel1'),panel2=child(layout,'panel2');
 assert.ok(panel1);assert.ok(panel2);assert.equal(panel2._active,false);
 for(const name of ['spin','stop']) {
  const node=child(panel1,name);
  const button=node._components.map(r=>scene[r.__id__]).find(c=>c.__type__==='cc.Button');
  assert.equal(button.clickEvents.length,1);
  assert.equal(scene[button.clickEvents[0].__id__].handler,name==='spin'?'onClickSpin':'onClickStop');
 }
 const walk=node=>{
  for(const r of node._components){
   const component=scene[r.__id__];assert.ok(component.__type__.startsWith('cc.'));
   if(component.__type__==='cc.Button')assert.deepEqual(component.clickEvents,[]);
  }
  node._children.forEach(r=>walk(scene[r.__id__]));
 };
 walk(panel2);
 assert.ok(child(panel1,'btn_menu'));assert.ok(child(panel2,'btn_close'));
});
test('replay switches directly to panel1 and restores the menu without coordinate drift', () => {
    const f = fixture();f.controller.show(2);f.advance();f.advance();
    const previous = f.controller.selected;
    f.controller.showImmediately(1);
    assert.equal(f.panel1.active,true);assert.equal(f.panel2.active,false);
    assert.equal(f.panel1.position.y,-111);
    f.controller.showImmediately(previous);
    assert.equal(f.panel1.active,false);assert.equal(f.panel2.active,true);
    f.controller.show(1);f.advance();f.advance();assert.equal(f.panel1.active,true);
});
test('forcing the replay panel invalidates in-flight menu callbacks', () => {
    const f = fixture();f.controller.show(2);const stale=f.pending.shift();
    f.controller.showImmediately(1);stale.done();
    assert.equal(f.panel1.active,true);assert.equal(f.panel2.active,false);assert.equal(f.pending.length,0);
});
