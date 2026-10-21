import test from 'node:test';
import assert from 'node:assert/strict';
import {rangeSummaries} from '../range-results.js';

const range=(id,start,end,delays)=>({range_id:id,gui:{playback_start:start,playback_end:end,time_scale_confirmed:true},samples:delays.map(delay=>({midpoint_ms:delay,delay_frames:delay/5}))});
test('By range calculates independent results instead of repeating pooled statistics',()=>{
  const report={distribution:{midpoint_ms:{mean:999}},ranges:[range(1,0,20,[10,20,30]),range(2,30,60,[100,120])]};
  const [first,second]=rangeSummaries(report);
  assert.equal(first.mean,20);assert.equal(first.median,20);assert.equal(first.p95,29);assert.equal(first.count,3);assert.equal(first.meanFrames,4);
  assert.equal(second.mean,110);assert.equal(second.median,110);assert.equal(second.p95,119);assert.equal(second.count,2);assert.equal(second.meanFrames,22);
  assert.equal(first.sum/first.count,first.mean);assert.equal(second.sum/second.count,second.mean);
  assert.deepEqual([second.start,second.end],[30,60]);
});
test('By range preserves signed delays and treats missing measurements as unavailable',()=>{
  const signed=range(1,0,20,[-10,5]);
  const empty={...range(2,30,60,[]),range_error:'Insufficient contrast'};
  const unknown={...range(3,70,80,[10]),gui:{playback_start:70,playback_end:80,time_scale_confirmed:false}};
  const results=rangeSummaries({ranges:[signed,empty,unknown]});
  assert.equal(results[0].mean,-2.5);assert.equal(results[0].sum,-5);
  assert.equal(results[1].mean,null);assert.equal(results[1].error,'Insufficient contrast');
  assert.equal(results[2].timed,false);assert.equal(results[2].mean,null);assert.equal(results[2].count,0);
});
