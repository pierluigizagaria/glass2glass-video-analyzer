// Browser port of optical_phone_analyze.py: sampling brackets and conservative
// irregular-sequence matching. No nearest-neighbour or interpolated timing.
export function quantile(values, q) {
  const a = [...values].sort((x,y)=>x-y), p=(a.length-1)*q, i=Math.floor(p);
  return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(p-i);
}
export function stats(values) {
  if (!values.length) return null;
  const a=[...values].sort((x,y)=>x-y);
  return {n:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,min:a[0],max:a.at(-1),
    p50:quantile(a,.5),p95:quantile(a,.95),p99:quantile(a,.99)};
}
export function normalizeRanges(ranges, duration) {
  const merged=[];
  for (const [a,b] of ranges.map(r=>[...r]).sort((a,b)=>a[0]-b[0])) {
    if (!Number.isFinite(a)||!Number.isFinite(b)||a<0||a>=b||b>duration+.05) throw Error('Choose valid ranges inside the video.');
    const last=merged.at(-1);
    if(last&&a<=last[1]) last[1]=Math.max(last[1],b); else merged.push([a,b]);
  }
  if(!merged.length) throw Error('Select at least one range.');
  return merged;
}
export function transitions(t,y,gap,threshold=null) {
  if(threshold!==null&&(!Number.isFinite(threshold)||threshold<0||threshold>255))throw Error('Brightness threshold must be between 0 and 255.');
  if(t.length<3||t.length!==y.length||t.some((v,i)=>!Number.isFinite(v)||(i&&v<=t[i-1]))||y.some(v=>!Number.isFinite(v))) throw Error('Need at least three frames with increasing timestamps.');
  const black=quantile(y,.1),white=quantile(y,.9);
  if(white-black<15) throw Error('Insufficient contrast: choose a changing patch inside the region.');
  const crossing=threshold??(black+white)/2;
  const z=y.map(v=>(v-crossing)/(white-black)+.5),events=[];
  let state=null,pending=null,stable=0,abandoned=0;
  for(let i=0;i<z.length;i++) {
    const v=z[i];
    if(state===null){if(v<=.4)state=0;else if(v>=.6)state=1;continue;}
    if(i>0&&(state===0?z[i-1]<.5&&v>=.5:z[i-1]>.5&&v<=.5)) {
      if(!pending)pending={lo_ms:t[i-1],hi_ms:t[i],frame_lo:i-1,frame_hi:i,crossings:1,gap:false};else pending.crossings++;
    }
    if(!pending)continue;
    pending.gap ||= i>0&&t[i]-t[i-1]>gap;
    stable=(state===0?v>=.6:v<=.4)?stable+1:0;
    if(stable>=2){
      events.push({event:events.length,polarity:state===0?'rise':'fall',lo_ms:pending.lo_ms,hi_ms:pending.hi_ms,
        midpoint_ms:(pending.lo_ms+pending.hi_ms)/2,frame_lo:pending.frame_lo,frame_hi:pending.frame_hi,
        confirmed_frame:i,reject_reason:pending.gap?'gap':pending.crossings>1?'recrossing':null});
      state=1-state;pending=null;stable=0;
    }else if(state===0?v<=.4:v>=.6){abandoned++;pending=null;stable=0;}
  }
  return [events,{black_p10:black,white_p90:white,threshold_50:(black+white)/2,threshold:crossing,threshold_mode:threshold===null?'auto':'manual',hysteresis_normalized:.1,stable_frames:2,
    middle_fraction:z.filter(v=>v>.4&&v<.6).length/z.length,abandoned_excursions:abandoned,incomplete_at_end:Number(Boolean(pending))}];
}
export function lowerBound(a,x){let l=0,r=a.length;while(l<r){const m=(l+r)>>>1;if(a[m]<x)l=m+1;else r=m;}return l;}
export function pairEvents(m,l,minimum=-50,maximum=150,tolerance=25) {
  const candidates=new Set(),rawM=m.map(()=>new Set()),rawL=l.map(()=>new Set()),times=l.map(e=>e.midpoint_ms);
  for(let i=0;i<m.length;i++)if(!m[i].reject_reason){
    for(let j=lowerBound(times,m[i].midpoint_ms+minimum);j<l.length&&times[j]<=m[i].midpoint_ms+maximum;j++){
      if(!l[j].reject_reason&&m[i].polarity===l[j].polarity){candidates.add(`${i},${j}`);rawM[i].add(j);rawL[j].add(i);}
    }
  }
  const supported=new Set();
  for(const pair of candidates){const [i,j]=pair.split(',').map(Number),chain=Array.from({length:4},(_,k)=>[i+k,j+k]);
    if(!chain.every(([a,b])=>candidates.has(`${a},${b}`)))continue;
    const a=[1,2,3].map(k=>m[i+k].midpoint_ms-m[i+k-1].midpoint_ms),b=[1,2,3].map(k=>l[j+k].midpoint_ms-l[j+k-1].midpoint_ms);
    if(Math.max(...a)-Math.min(...a)>=12&&a.every((v,k)=>Math.abs(v-b[k])<=tolerance))chain.forEach(([x,y])=>supported.add(`${x},${y}`));
  }
  const sm=m.map(()=>new Set()),sl=l.map(()=>new Set());
  for(const pair of supported){const [i,j]=pair.split(',').map(Number);sm[i].add(j);sl[j].add(i);}
  let selected=[];sm.forEach((js,i)=>{const j=[...js][0];if(js.size===1&&sl[j].size===1)selected.push([i,j]);});
  const conflicts=new Set();
  while(true){const bad=new Set();for(let k=1;k<selected.length;k++)if(selected[k][1]<=selected[k-1][1]){bad.add(selected[k].join(','));bad.add(selected[k-1].join(','));}
    if(!bad.size)break;bad.forEach(p=>conflicts.add(p));selected=selected.filter(p=>!bad.has(p.join(',')));}
  const matchedM=new Set(selected.map(p=>p[0])),matchedL=new Set(selected.map(p=>p[1]));
  function classify(events,matches,raw,support,side){return events.map((e,i)=>({...e,pairing:matches.has(i)?'matched':e.reject_reason||
    ([...conflicts].some(p=>Number(p.split(',')[side])===i)?'order_conflict':support[i].size>1?'ambiguous':support[i].size?'ambiguous_partner':raw[i].size?'insufficient_irregular_sequence':'no_candidate_in_window')}));}
  const mr=classify(m,matchedM,rawM,sm,0),lr=classify(l,matchedL,rawL,sl,1);
  const count=rows=>rows.reduce((a,r)=>(a[r.pairing]=(a[r.pairing]||0)+1,a),{});
  const samples=selected.map(([i,j])=>{const a=m[i],b=l[j],lower=b.lo_ms-a.hi_ms,upper=b.hi_ms-a.lo_ms;
    return {monitor_event:i,lens_event:j,polarity:a.polarity,monitor_lo_ms:a.lo_ms,monitor_hi_ms:a.hi_ms,lens_lo_ms:b.lo_ms,lens_hi_ms:b.hi_ms,
      lower_ms:lower,upper_ms:upper,midpoint_ms:(lower+upper)/2,monitor_frame_lo:a.frame_lo,monitor_frame_hi:a.frame_hi,lens_frame_lo:b.frame_lo,lens_frame_hi:b.frame_hi,
      delay_frames:(b.frame_lo+b.frame_hi-a.frame_lo-a.frame_hi)/2};});
  return {samples,monitor_events:mr,lens_events:lr,counts:{monitor:count(mr),lens:count(lr),matched:samples.length,
    discarded_monitor:m.length-samples.length,discarded_lens:l.length-samples.length,coverage_monitor:m.length?samples.length/m.length:0,coverage_lens:l.length?samples.length/l.length:0}};
}
function distribution(samples){return samples.length?{midpoint_ms:stats(samples.map(s=>s.midpoint_ms)),lower_ms:stats(samples.map(s=>s.lower_ms)),upper_ms:stats(samples.map(s=>s.upper_ms)),ecdf_ms:samples.map(s=>s.midpoint_ms).sort((a,b)=>a-b)}:null;}
export function uncertainty(samples){
  const n=samples.length;if(!n)return null;const mean=samples.reduce((a,s)=>a+s.midpoint_ms,0)/n;
  const widths=samples.map(s=>[s.monitor_hi_ms-s.monitor_lo_ms,s.lens_hi_ms-s.lens_lo_ms]);
  const q=Math.sqrt(widths.reduce((a,[x,y])=>a+(x+y)**2/12,0))/n;
  const sd=n>1?Math.sqrt(samples.reduce((a,s)=>a+(s.midpoint_ms-mean)**2,0)/(n-1)):null;
  const blocks=new Map();samples.forEach(s=>{const k=Math.floor(s.monitor_event/10);blocks.set(k,(blocks.get(k)||0)+s.midpoint_ms-mean);});
  const b=blocks.size,cluster=b>1?Math.sqrt(b/(b-1)*[...blocks.values()].reduce((a,x)=>a+x*x,0))/n:null,iid=sd===null?null:sd/Math.sqrt(n),se=Math.max(q,cluster||0,iid||0);
  let ci=null;if(n>=30&&b>=4){const df=b-1,z=1.959963984540054,c=z+(z**3+z)/(4*df)+(5*z**5+16*z**3+3*z)/(96*df**2)+(3*z**7+19*z**5+17*z**3-15*z)/(384*df**3);ci=[mean-c*se,mean+c*se];}
  return {n,observed_sd_ms:sd,iid_se_ms:iid,cluster_se_ms:cluster,blocks:b,block_events:10,quantization_covariance_bound_se_ms:q,se_used_ms:se,ci95_mean_ms:ci};
}
export function analyzeTraces(info, traces, request){
  const ranges=normalizeRanges(request.ranges,info.duration),scale=request.scale;
  const threshold=request.channel==='luma'?(request.threshold??null):null;
  if(threshold!==null&&(!Number.isFinite(threshold)||threshold<0||threshold>255))throw Error('Brightness threshold must be between 0 and 255.');
  if(scale!==null&&(!Number.isFinite(scale)||scale<=0))throw Error('Choose valid recording timing.');
  if(![request.minimum,request.maximum,request.tolerance].every(Number.isFinite)||request.minimum>=request.maximum||request.tolerance<=0)throw Error('Check matching limits.');
  if(traces.some((t,i)=>!Number.isFinite(t.playback_seconds)||(i&&t.playback_seconds<=traces[i-1].playback_seconds)))throw Error('Duplicate or unordered frame timestamps: reliable measurement is unavailable.');
  const reports=ranges.map(([a,b],index)=>{
    const chosen=traces.filter(t=>t.playback_seconds>=a&&t.playback_seconds<=b),t=chosen.map(v=>v.playback_seconds*1000*(scale??1));
    const report={range_id:index+1,samples:[],counts:{},distribution:null,uncertainty:null,calibration:{},warnings:[],
      gui:{playback_start:a,playback_end:b,time_scale_confirmed:scale!==null},monitor_events:[],lens_events:[]};
    try{if(t.length<3)throw Error('This range contains fewer than three frames.');
      const gap=quantile(t.slice(1).map((v,i)=>v-t[i]),.5)*1.8;
      for(const [name,field] of [['monitor','monitor_luma'],['lens','lens_luma']]){
        const [events,calibration]=transitions(t,chosen.map(v=>v[field]),gap,threshold);
        events.forEach(e=>{for(const key of ['frame_lo','frame_hi','confirmed_frame'])e[key]=chosen[e[key]].frame;});
        report[name+'_events']=events;report.calibration[name]=calibration;
      }
      if(scale!==null)Object.assign(report,pairEvents(report.monitor_events,report.lens_events,request.minimum,request.maximum,request.tolerance));
      report.samples.forEach(s=>s.range_id=index+1);report.distribution=distribution(report.samples);report.uncertainty=scale===null?null:uncertainty(report.samples);
    }catch(e){report.range_error=e.message;}
    return report;
  });
  const samples=[],events={monitor:[],lens:[]};let mo=0,lo=0;
  for(const r of reports){samples.push(...r.samples.map(s=>({...s,monitor_event:s.monitor_event+mo,lens_event:s.lens_event+lo})));
    events.monitor.push(...r.monitor_events.map(e=>({...e,event:e.event+mo,range_id:r.range_id})));events.lens.push(...r.lens_events.map(e=>({...e,event:e.event+lo,range_id:r.range_id})));mo+=r.monitor_events.length;lo+=r.lens_events.length;}
  traces.forEach(row=>{const i=ranges.findIndex(([a,b])=>a<=row.playback_seconds&&row.playback_seconds<=b);row.in_analysis=i>=0;row.range_id=i<0?null:i+1;row.capture_ms=scale===null?null:row.playback_seconds*scale*1000;});
  return {traces,report:{version:2,scope:'Glass2Glass Video Analyzer — browser-local optical comparison',video:{file_name:info.name,decoded_frames:traces.length,nominal_fps:info.fps,capture_fps:info.capture_fps,capture_fps_source:info.capture_source},
    settings:{monitor_roi:request.rois[0],lens_roi:request.rois[1],pts_scale:scale,timebase_note:request.note,min_latency_ms:request.minimum,max_latency_ms:request.maximum,sequence_tolerance_ms:request.tolerance,brightness_threshold:threshold},
    samples,distribution:distribution(samples),uncertainty:reports.length===1?reports[0].uncertainty:null,ranges:reports,
    monitor_events:events.monitor,lens_events:events.lens,counts:{matched:samples.length,discarded_monitor:mo-samples.length,discarded_lens:lo-samples.length},
    gui:{playback_start:ranges[0][0],playback_end:ranges.at(-1)[1],playback_ranges:ranges.map(([start,end])=>({start,end})),time_scale_confirmed:scale!==null,signal_channel:request.channel,note:request.note},warnings:[]}};
}
