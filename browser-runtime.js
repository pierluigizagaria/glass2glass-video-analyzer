import workerCode from './media-worker.js?worker';
import {zipSync,strToU8} from 'fflate';
let serial=0;
function spawn(){
  const url=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
  const pending=new Map();
  worker.onmessage=({data})=>{if(data.kind==='progress'){worker.progress?.(data);return;}const task=pending.get(data.id);if(!task){data.value?.image?.close();return;}pending.delete(data.id);if(data.error)task.reject(Error(data.error));else task.resolve(data.value);};
  worker.onerror=e=>{for(const task of pending.values())task.reject(Error(e.message||'Video processing failed.'));pending.clear();};
  return {worker,request:(kind,body={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,kind,...body});}),
    close:()=>{worker.terminate();for(const task of pending.values())task.reject(Error('Cancelled'));pending.clear();}};
}
function download(name,blob){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function csv(rows,fields){return '\ufeff'+[fields.join(','),...rows.map(row=>fields.map(k=>{const v=row[k]??'';return '"'+String(v).replaceAll('"','""')+'"';}).join(','))].join('\r\n');}
export class BrowserRuntime{
  constructor(){this.info=null;this.version=0;this.result=null;this.job={state:'idle',progress:0,message:'Ready',revision:0};}
  snapshot(){return {info:this.info,version:this.version,job:this.job,ready:Boolean(this.result)};}
  async open(file){
    if(this.job.state==='running')throw Error('Cancel analysis before opening another video.');
    const next=spawn();try{const info=await next.request('open',{file});this.previewWorker?.close();this.previewWorker=next;this.file=file;this.info=info;this.version++;this.result=null;this.job={state:'idle',progress:0,message:'Ready',revision:this.job.revision+1};return this.snapshot();}catch(error){next.close();throw error;}
  }
  async call(path,request){
    if(path==='state')return this.snapshot();
    if(path==='results')return this.result;
    if(path==='preview'){const version=this.version;return {...await this.previewWorker.request('preview',{request}),version};}
    if(path==='analyze'){
      if(this.job.state==='running')throw Error('Analysis is already running.');
      if(!this.file)throw Error('Open a video first.');
      if(!request?.ranges?.length)throw Error('Add at least one range to analyze.');
      const revision=this.job.revision+1;this.job={state:'running',progress:0,message:'Reading selected ranges…',revision};
      const task=spawn();this.analysisWorker=task;
      task.worker.progress=data=>{if(this.job.revision===revision&&this.job.state==='running')this.job={...this.job,...data};};
      task.request('analyze',{file:this.file,request}).then(value=>{if(this.job.revision!==revision||this.job.state!=='running')return;this.result=value;this.job={state:'done',progress:1,message:'Analysis complete',revision};}).catch(error=>{if(this.job.revision===revision&&this.job.state==='running')this.job={state:'error',progress:0,message:error.message,revision};}).finally(()=>task.close());
      return this.snapshot();
    }
    if(path==='cancel'){this.job={...this.job,state:'cancelled',progress:0};this.analysisWorker?.close();return {ok:true};}
    if(path==='export'){
      if(!this.result)throw Error('Run analysis first.');
      const {report,traces}=this.result;
      const ranges=report.ranges.map(r=>({range_id:r.range_id,start_playback_seconds:r.gui.playback_start,end_playback_seconds:r.gui.playback_end,matched:r.samples.length,mean_ms:r.distribution?.midpoint_ms?.mean,error:r.range_error||''}));
      const files={'report.json':strToU8(JSON.stringify(report,null,2))};
      for(const [name,rows,fields] of [['luminance.csv',traces,Object.keys(traces[0]||{frame:0})],['pairs.csv',report.samples,Object.keys(report.samples[0]||{midpoint_ms:0,delay_frames:0,range_id:0})],['ranges.csv',ranges,Object.keys(ranges[0])]])files[name]=strToU8(csv(rows,fields));
      const name='glass2glass-'+new Date().toISOString().replaceAll(':','-').slice(0,19)+'.zip';download(name,new Blob([zipSync(files)],{type:'application/zip'}));return {name};
    }
    throw Error('Unknown browser operation.');
  }
}
