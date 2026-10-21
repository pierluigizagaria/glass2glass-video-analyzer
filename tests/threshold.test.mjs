import test from 'node:test';
import assert from 'node:assert/strict';
import {transitions,analyzeTraces} from '../engine.js';

const y=[20,20,20,60,90,110,140,200,200,200,200,160,130,100,70,20,20,20];
const t=y.map((_,i)=>i*10);
test('custom brightness threshold changes measured crossing brackets',()=>{
  const [low,lc]=transitions(t,y,18,80),[high,hc]=transitions(t,y,18,150);
  assert.deepEqual(low.map(e=>[e.polarity,e.frame_hi]),[['rise',4],['fall',14]]);
  assert.deepEqual(high.map(e=>[e.polarity,e.frame_hi]),[['rise',7],['fall',12]]);
  assert.equal(lc.threshold,80);assert.equal(hc.threshold_mode,'manual');
  assert.equal(transitions(t,y,18)[1].threshold_mode,'auto');
});
test('threshold endpoints are valid and do not invent transitions',()=>{
  for(const threshold of [0,255])assert.equal(transitions(t,y,18,threshold)[0].length,0);
  for(const threshold of [-1,256,NaN,Infinity,'128'])assert.throws(()=>transitions(t,y,18,threshold),/0 and 255/);
});
test('report records custom threshold for both regions and respects signal channel',()=>{
  const info={name:'synthetic',duration:.18,fps:100};
  const traces=y.map((v,i)=>({frame:i,playback_seconds:i/100,monitor_luma:v,lens_luma:v}));
  const request={rois:[[0,0,1,1],[1,0,1,1]],ranges:[[0,.18]],scale:1,channel:'luma',threshold:80,minimum:-50,maximum:150,tolerance:25};
  const report=analyzeTraces(info,traces,request).report;
  assert.equal(report.settings.brightness_threshold,80);
  for(const region of ['monitor','lens'])assert.equal(report.ranges[0].calibration[region].threshold,80);
  assert.equal(analyzeTraces(info,traces,{...request,channel:'red'}).report.settings.brightness_threshold,null);
  assert.throws(()=>analyzeTraces(info,traces,{...request,threshold:256}),/0 and 255/);
});
