import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {analyzeTraces,pairEvents,normalizeRanges,frameIndexAtTimestamp} from '../engine.js';
import {captureTiming} from '../timing.js';
import {constrainView,zoomView,rangeBoundary} from '../timeline.js';
const fixture=new URL('../../bench/optical/tool-validation/20261021-010054/optical-latency-20261021-010347/',import.meta.url);
const privateFixtureAvailable=existsSync(new URL('report.json',fixture));
function golden(){
  const report=JSON.parse(readFileSync(new URL('report.json',fixture),'utf8'));
  const [header,...lines]=readFileSync(new URL('luminance.csv',fixture),'utf8').replace(/^\ufeff/,'').trim().split(/\r?\n/),fields=header.split(',');
  const traces=lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[fields[i],v==='True'?true:v==='False'?false:v===''?null:Number.isFinite(Number(v))?Number(v):v])));
  return {report,traces,info:{name:'regression',duration:traces.at(-1).playback_seconds+.04,fps:30},request:{rois:[[330,415,60,20],[1250,415,50,20]],ranges:[[90,162]],scale:.125,note:'Verified regression scale',channel:'luma',minimum:-50,maximum:150,tolerance:25}};
}
test('browser maths reproduces every archived optical pair and statistics',{skip:!privateFixtureAvailable},()=>{
  const g=golden(),actual=analyzeTraces(g.info,g.traces,g.request).report;
  assert.equal(actual.samples.length,50);assert.equal(g.report.samples.length,50);
  for(let i=0;i<50;i++)for(const [k,v] of Object.entries(g.report.samples[i])){
    if(typeof v==='number')assert.ok(Math.abs(actual.samples[i][k]-v)<1e-8,`pair ${i} ${k}: ${actual.samples[i][k]} vs ${v}`);
    else assert.equal(actual.samples[i][k],v);
  }
  for(const k of ['mean','p50','p95'])assert.ok(Math.abs(actual.distribution.midpoint_ms[k]-g.report.distribution.midpoint_ms[k])<1e-8);
  assert.ok(actual.samples.some(s=>s.midpoint_ms<0));
});
test('disjoint ranges never pair across an excluded gap',{skip:!privateFixtureAvailable},()=>{
  const g=golden(),result=analyzeTraces(g.info,g.traces,{...g.request,ranges:[[90,115],[135,162]]});
  assert.equal(result.report.ranges.length,2);assert.ok(result.report.samples.length>10);
  for(const s of result.report.samples)for(const k of ['monitor_frame_lo','monitor_frame_hi','lens_frame_lo','lens_frame_hi'])assert.equal(result.traces[s[k]].range_id,s.range_id);
  assert.ok(result.traces.filter(t=>t.playback_seconds>116&&t.playback_seconds<134).every(t=>!t.in_analysis));
  assert.equal(result.report.uncertainty,null);
});
test('unknown timing produces no absolute delays',{skip:!privateFixtureAvailable},()=>{
  const g=golden(),{report,traces}=analyzeTraces(g.info,g.traces,{...g.request,scale:null});
  assert.deepEqual(report.samples,[]);assert.equal(report.distribution,null);assert.ok(traces.every(t=>t.capture_ms===null));
});
test('periodic ambiguity is rejected, not resolved by closest delay',()=>{
  const events=Array.from({length:15},(_,i)=>({event:i,midpoint_ms:i*100,lo_ms:i*100-2,hi_ms:i*100+2,frame_lo:i*24,frame_hi:i*24+1,polarity:i%2?'fall':'rise',reject_reason:null}));
  assert.equal(pairEvents(events,events.map(e=>({...e,midpoint_ms:e.midpoint_ms+20,lo_ms:e.lo_ms+20,hi_ms:e.hi_ms+20}))).samples.length,0);
});
test('capture FPS uses only explicit acquisition metadata',()=>{
  const bytes=new Uint8Array(4);new DataView(bytes.buffer).setFloat32(0,240,false);
  assert.equal(captureTiming({'com.android.capture.fps':bytes}).capture_fps,240);
  assert.equal(captureTiming({'com.android.capture.fps':'240.000000'}).capture_fps,240);
  assert.equal(captureTiming({fps:240,frame_rate:240}).capture_fps,null);
  for(const value of [NaN,Infinity,0,-30,'NaN','30 fps',new Uint8Array(2)])assert.equal(captureTiming({'com.android.capture.fps':value}).capture_fps,null);
});

test('selected decoded frames retain their original index despite sub-microsecond timestamp rounding',()=>{
  const timestamps=[2,2+1001/30000,2+2002/30000,2.15];
  for(const [index,pts] of timestamps.entries())for(const delta of [-.0000007,0,.0000007]){
    assert.equal(frameIndexAtTimestamp(timestamps,pts+delta),index);
  }
  assert.throws(()=>frameIndexAtTimestamp(timestamps,2.1),/Cannot map/);
  assert.throws(()=>frameIndexAtTimestamp([],0),/Cannot map/);
});
test('zoom stays anchored, bounded, and independent of valid ranges',()=>{
  assert.deepEqual(zoomView([20,60],100,.5,.25),[25,45]);
  assert.deepEqual(constrainView([-5,15],100),[0,20]);
  assert.deepEqual(constrainView([95,115],100),[80,100]);
  assert.deepEqual(zoomView([20,60],100,100),[0,100]);
  assert.deepEqual(normalizeRanges([[20,30],[0,10],[8,12]],100),[[0,12],[20,30]]);
});

test('range navigation visits starts and ends in order, skips gaps and stops at the limits',()=>{
  const ranges=[[30.013,60.013],[.013,20.013]];
  assert.equal(rangeBoundary([],10,1),null);
  assert.equal(rangeBoundary(ranges,0,-1),null);
  let position=0;
  for(const expected of [.013,20.013,30.013,60.013]){position=rangeBoundary(ranges,position,1);assert.equal(position,expected);}
  assert.equal(rangeBoundary(ranges,position,1),null);
  for(const expected of [30.013,20.013,.013]){position=rangeBoundary(ranges,position,-1);assert.equal(position,expected);}
  assert.equal(rangeBoundary(ranges,position,-1),null);
  assert.equal(rangeBoundary([[0,10],[10,20]],10,1),20);
  assert.equal(rangeBoundary(ranges,25,-1),20.013);
  assert.equal(rangeBoundary(ranges,25,1),30.013);
});
test('standalone HTML has valid embedded code and blocks network connections',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
  assert.ok(html.includes("connect-src 'none'"));assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/<link[^>]+stylesheet/.test(html));
  assert.ok(html.includes('Glass2Glass Video Analyzer'));
});
