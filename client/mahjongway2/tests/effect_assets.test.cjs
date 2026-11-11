const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const project = path.resolve(__dirname, '..');

test('AG2 symbol effect paths resolve against the imported 1024 prefab', () => {
    const source = fs.readFileSync(path.join(project, 'assets/mahjongway2/src/effects/effect_library.ts'), 'utf8');
    const table = source.slice(source.indexOf('export const symbolPaths:'), source.indexOf('export class EffectLibrary'));
    const entries = [...table.matchAll(/(\d+):\s*'([^']+)'/g)];
    assert.equal(entries.length, 11);
    const prefab = JSON.parse(fs.readFileSync(path.join(project, 'assets/resources/mahjong_effects/mahjongway/res/load/prefab/games/cell_win.prefab'), 'utf8'));
    const root = prefab[prefab[0].data.__id__];
    for (const [, symbol, nodePath] of entries) {
        let node = root;
        for (const name of nodePath.split('/')) {
            node = node?._children.map(ref => prefab[ref.__id__]).find(child => child._name === name);
            assert.ok(node, 'Missing effect node for artwork ' + symbol + ': ' + nodePath);
        }
    }
});

test('cell_win instances ignore prefab editor position and preserve artwork scale',()=>{
    const Module = require('node:module');
    const ts = require('../../../slot_math/node_modules/typescript');
    const sourceFile = path.join(project, 'assets/mahjongway2/src/effects/effect_library.ts');
    const vector = (x,y,z) => ({ x,y,z,clone(){return vector(this.x,this.y,this.z);} });
    const node = {
        position: vector(1000,1000,0),
        scale: vector(.65,.65,1),
        eulerAngles: vector(0,0,0),
        active: true,
        children: [],
        getComponent(){return null;},
        getComponentsInChildren(){return [];},
        setPosition(x,y,z){this.position=typeof x==='object'?x.clone():vector(x,y,z);},
        setScale(value){this.scale=value.clone();},
        setRotationFromEuler(value){this.eulerAngles=value.clone();},
    };
    const original = Module._load;
    Module._load = function(id,parent,...args){
        if(id==='cc') return { instantiate:()=>node };
        if(id==='./MWSpriteCtrl') return { MWSpriteCtrl:class{} };
        return original.call(this,id,parent,...args);
    };
    try {
        const loaded = new Module(sourceFile,module);
        loaded.filename=sourceFile;
        loaded.paths=Module._nodeModulePaths(path.dirname(sourceFile));
        loaded._compile(ts.transpileModule(fs.readFileSync(sourceFile,'utf8'),{
            compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
        }).outputText,sourceFile);
        loaded.exports.EffectLibrary.prefabs.set('cell_win',{});
        const effect=loaded.exports.EffectLibrary.create('cell_win',{addChild(){}});
        assert.equal(effect.node.position.x,0);
        assert.equal(effect.node.position.y,0);
        assert.equal(effect.node.scale.x,.65);
        effect.reset();
        assert.equal(effect.node.position.x,0);
        assert.equal(effect.node.position.y,0);
        assert.equal(effect.node.scale.x,.65);
    } finally {
        Module._load=original;
    }
});
