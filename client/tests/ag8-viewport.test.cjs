const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../fortunedragon');
for(const template of ['build-templates/web-mobile','preview-template'])test(`AG8 ${template}: defers zero-sized resize and resumes without losing later resizes`,()=>{
 const file=path.join(root,template,'loading/viewport.js');assert(fs.existsSync(file),'viewport guard must exist before Cocos loads');
 const callbacks=new Map(),listeners=new Map();let id=0,engineCalls=0;
 const window={innerWidth:390,innerHeight:250,addEventListener(name,fn,options){const list=listeners.get(name)||[];list.push({fn,capture:options===true||options?.capture});listeners.set(name,list);},
 dispatchEvent(event){event.stopped=false;event.stopImmediatePropagation=()=>event.stopped=true;for(const {fn} of [...listeners.get(event.type)||[]].sort((a,b)=>Number(b.capture)-Number(a.capture))){fn(event);if(event.stopped)break;}}};
 const box={window,Event:class{constructor(type){this.type=type;}},requestAnimationFrame(fn){callbacks.set(++id,fn);return id;},cancelAnimationFrame(key){callbacks.delete(key);}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),box);
 window.addEventListener('resize',()=>{assert(window.innerWidth>0&&window.innerHeight>0);engineCalls++;});
 const resize=()=>window.dispatchEvent(new box.Event('resize'));
 resize();assert.equal(engineCalls,1);
 for(const size of [[0,250],[390,0],[0,0]]){[window.innerWidth,window.innerHeight]=size;resize();resize();assert.equal(engineCalls,1);assert.equal(callbacks.size,1);}
 window.innerWidth=390;window.innerHeight=852;
 const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn());
 assert.equal(engineCalls,2);assert.equal(callbacks.size,0);
 resize();assert.equal(engineCalls,3);
 const html=fs.readFileSync(path.join(root,template,'index.ejs'),'utf8');
 assert(html.indexOf('loading/viewport.js')>=0&&html.indexOf('loading/viewport.js')<html.indexOf('<%- include(cocosTemplate'),'guard must run before engine setup');
});
