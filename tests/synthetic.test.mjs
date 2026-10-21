import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTraces} from '../engine.js';

// Deterministic invented signals: no personal recordings or captured metadata.
function fixture(){
  const edges=[];let time=200;
  for(let i=0;i<45;i++){time+=[137,251,179,313,227,359,193][i%7];edges.push(time);}
  const value=t=>edges.filter(e=>e<=t).length%2?220:20;
  const traces=Array.from({length:Math.ceil((time+400)*.24)},(_,frame)=>({frame,playback_seconds:frame/240,monitor_luma:value(frame/240*1000),lens_luma:value(frame/240*1000-20)}));
  const info={name:'Generated signals',duration:traces.at(-1).playback_seconds,fps:240};
  const request={rois:[[0,0,1,1],[1,0,1,1]],ranges:[[0,info.duration]],scale:1,channel:'luma',threshold:null,minimum:-50,maximum:150,tolerance:25};
  return {info,traces,request};
}
test('irregular synthetic signals recover all 45 transitions and bracket the known 20 ms delay',()=>{
  const g=fixture(),r=analyzeTraces(g.info,g.traces,g.request).report;
  assert.equal(r.samples.length,45);
  for(const sample of r.samples){assert.ok(sample.lower_ms<=20);assert.ok(sample.upper_ms>=20);}
  assert.ok(Math.abs(r.distribution.midpoint_ms.mean-20)<1);
});
test('synthetic gap excludes samples and never joins transition pairs across ranges',()=>{
  const g=fixture(),r=analyzeTraces(g.info,g.traces,{...g.request,ranges:[[0,3],[6,g.info.duration]]});
  assert.ok(r.report.samples.length>20);assert.equal(r.report.ranges.length,2);
  for(const pair of r.report.samples)for(const k of ['monitor_frame_lo','monitor_frame_hi','lens_frame_lo','lens_frame_hi'])assert.equal(r.traces[pair[k]].range_id,pair.range_id);
  assert.ok(r.traces.filter(t=>t.playback_seconds>3&&t.playback_seconds<6).every(t=>!t.in_analysis));
});
test('unknown synthetic timing retains traces and produces no absolute delay',()=>{
  const g=fixture(),r=analyzeTraces(g.info,g.traces,{...g.request,scale:null});
  assert.equal(r.report.samples.length,0);assert.equal(r.report.distribution,null);assert.ok(r.traces.every(t=>t.capture_ms===null));
});

test('measuring only saved ranges preserves original frame numbers and all per-range calculations',()=>{
  const g=fixture(),request={...g.request,ranges:[[1,3],[6,g.info.duration-1]]};
  const full=analyzeTraces(g.info,g.traces,request);
  const selected=g.traces.filter(t=>request.ranges.some(([a,b])=>t.playback_seconds>=a&&t.playback_seconds<=b));
  const compact=analyzeTraces(g.info,selected,request);
  assert.ok(compact.report.samples.length>15);
  assert.deepEqual(compact.report.samples,full.report.samples);
  assert.deepEqual(compact.report.ranges,full.report.ranges);
  assert.deepEqual(compact.report.distribution,full.report.distribution);
  assert.equal(compact.traces[0].frame,240);
  assert.ok(compact.traces.length<full.traces.length);
  assert.ok(compact.traces.every(t=>t.in_analysis));
  for(const pair of compact.report.samples)for(const key of ['monitor_frame_lo','monitor_frame_hi','lens_frame_lo','lens_frame_hi']){
    assert.equal(compact.traces.find(t=>t.frame===pair[key]).range_id,pair.range_id);
  }
});

test('a flat signal identifies the failing region without fabricating measurements',()=>{
  for(const [field,label] of [['monitor_luma','Reference'],['lens_luma','Output']]){
    const g=fixture();g.traces.forEach(row=>row[field]=100);
    const result=analyzeTraces(g.info,g.traces,g.request);
    assert.equal(result.report.samples.length,0);
    assert.match(result.report.ranges[0].range_error,new RegExp(`^${label}: Insufficient contrast`));
    assert.equal(result.report.distribution,null);
    assert.equal(result.traces.length,g.traces.length);
  }
});
