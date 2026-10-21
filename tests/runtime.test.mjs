import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:[new URL('../browser-runtime.js',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],bundle:true,write:false,format:'esm',plugins:[{name:'test-worker',setup(b){b.onResolve({filter:/\?worker$/},()=>({path:'worker',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export default ""'}));}}]});
const {BrowserRuntime}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('results survive edits, recalculation, cancellation and failure until a successful replacement',async()=>{
  const original=globalThis.Worker;
  class WorkerStub {
    static latest;
    constructor(){WorkerStub.latest=this;}
    postMessage(message){this.message=message;if(message.kind==='open')queueMicrotask(()=>this.finish({name:'synthetic'}));}
    finish(value){this.onmessage({data:{id:this.message.id,value}});}
    fail(){this.onmessage({data:{id:this.message.id,error:'Unsupported fixture'}});}
    terminate(){this.terminated=true;}
  }
  globalThis.Worker=WorkerStub;
  try{
    const runtime=new BrowserRuntime();await runtime.open(new Blob());
    await runtime.call('analyze',{threshold:null});const first={report:{label:'first'},traces:[1]};WorkerStub.latest.finish(first);await settle();
    assert.equal(runtime.result,first);
    await runtime.call('analyze',{threshold:128});assert.equal(runtime.result,first);assert.equal(runtime.snapshot().ready,true);
    const cancelled=WorkerStub.latest;await runtime.call('cancel');await settle();assert.equal(runtime.result,first);assert.equal(cancelled.terminated,true);
    await runtime.call('analyze',{threshold:200});WorkerStub.latest.fail();await settle();assert.equal(runtime.job.state,'error');assert.equal(runtime.result,first);
    await runtime.call('analyze',{threshold:100});const next={report:{label:'next'},traces:[2]};assert.equal(runtime.result,first);WorkerStub.latest.finish(next);await settle();assert.equal(runtime.result,next);assert.equal(runtime.job.state,'done');
    await runtime.open(new Blob());assert.equal(runtime.result,null);
  }finally{globalThis.Worker=original;}
});
