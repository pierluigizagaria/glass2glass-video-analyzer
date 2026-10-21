import {Input,BlobSource,ALL_FORMATS,VideoSampleSink,EncodedPacketSink} from 'mediabunny';
import {captureTiming} from './timing.js';
import {analyzeTraces,lowerBound,normalizeRanges,frameIndexAtTimestamp} from './engine.js';
let input,track,sink,info,timestamps=[];
async function open(file){
  if(typeof VideoDecoder==='undefined')throw Error('This browser cannot decode individual video frames. Open this page in a recent Chrome or Edge.');
  input?.dispose();input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
  track=await input.getPrimaryVideoTrack();if(!track)throw Error('This file has no video track.');
  if(!await track.canDecode())throw Error('The browser cannot decode this video codec. Try Chrome/Edge or an H.264 MP4 original.');
  const [width,height,rotation,end,tags,metrics]=await Promise.all([track.getCodedWidth(),track.getCodedHeight(),track.getRotation(),track.computeDuration(),input.getMetadataTags(),track.computeFrameRateMetrics()]);
  timestamps=[];for await(const packet of new EncodedPacketSink(track).packets(undefined,undefined,{metadataOnly:true}))timestamps.push(packet.timestamp);
  timestamps.sort((a,b)=>a-b);
  if(!timestamps.length)throw Error('This video has no readable frames.');
  const first=timestamps[0],capture=captureTiming(tags.raw),fps=metrics.bestGuessFrameRate;
  info={name:file.name,width,height,rotation,duration:end-first,fps,frames:timestamps.length,first_pts:first,...capture,
    auto_scale:capture.capture_fps&&Number.isFinite(fps)&&fps>0?fps/capture.capture_fps:null,
    timing_estimated:metrics.underlyingFrameRate===null,
    variable_rate:!metrics.frameRateIsConstant,codec:await track.getCodec()};
  sink=new VideoSampleSink(track);return info;
}
async function preview({seconds,direction=0}){
  let t=info.first_pts+Math.max(0,Math.min(seconds,info.duration));
  let i=lowerBound(timestamps,t-1e-7);
  if(direction<0)i=Math.max(0,i-1);else if(direction>0)i=lowerBound(timestamps,t+1e-7);
  i=Math.min(timestamps.length-1,i);t=timestamps[i];
  const sample=await sink.getSample(t+1e-7);if(!sample)throw Error('No frame at this position.');
  try{sample.setRotation(0);const canvas=new OffscreenCanvas(info.width,info.height);
    canvas.getContext('2d').drawImage(sample.toCanvasImageSource(),0,0,info.width,info.height);
    return {position:sample.timestamp-info.first_pts,image:canvas.transferToImageBitmap()};
  }finally{sample.close();}
}
async function analyze(file,request){
  await open(file);
  const ranges=normalizeRanges(request.ranges,info.duration);
  for(const r of request.rois)if(r.length!==4||r.some(v=>!Number.isInteger(v))||r[0]<0||r[1]<0||r[2]<=0||r[3]<=0||r[0]+r[2]>info.width||r[1]+r[3]>info.height)throw Error('The regions must be inside the original video.');
  const canvases=request.rois.map(r=>new OffscreenCanvas(r[2],r[3]));
  const contexts=canvases.map(c=>c.getContext('2d',{willReadFrequently:true}));
  let buffer;const traces=[];
  const total=timestamps.filter(pts=>ranges.some(([a,b])=>pts-info.first_pts>=a&&pts-info.first_pts<=b)).length;
  for(const [index,[a,b]] of ranges.entries()){
    postMessage({kind:'progress',progress:Math.min(.98,traces.length/Math.max(1,total)),message:`Measuring range ${index+1} of ${ranges.length}`});
    for await(const sample of sink.samples(info.first_pts+a,info.first_pts+b+1e-7)){
      try{
        const seconds=sample.timestamp-info.first_pts;
        if(seconds<a||seconds>b)continue;
        const frame=frameIndexAtTimestamp(timestamps,sample.timestamp);
        if(sample.squarePixelWidth!==info.width||sample.squarePixelHeight!==info.height)throw Error('Changing dimensions or non-square pixels are not supported for measurement.');
        let values;
        if(request.channel==='luma'&&['I420','I420A','I422','I444','NV12'].includes(sample.format)){
          const length=sample.allocationSize();if(!buffer||buffer.length!==length)buffer=new Uint8Array(length);
          const [plane]=await sample.copyTo(buffer);
          values=request.rois.map(([x,y,w,h])=>{let sum=0;for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)sum+=buffer[plane.offset+row*plane.stride+col];return sum/(w*h);});
        }else{
          sample.setRotation(0);const image=sample.toCanvasImageSource();
          values=request.rois.map(([x,y,w,h],i)=>{contexts[i].drawImage(image,x,y,w,h,0,0,w,h);const data=contexts[i].getImageData(0,0,w,h).data;let sum=0;
            for(let p=0;p<data.length;p+=4)sum+=request.channel==='luma'?.2126*data[p]+.7152*data[p+1]+.0722*data[p+2]:data[p+['red','green','blue'].indexOf(request.channel)];return sum/(w*h);});
        }
        traces.push({frame,pts_seconds:sample.timestamp,playback_seconds:seconds,monitor_luma:values[0],lens_luma:values[1]});
        if(traces.length%32===0)postMessage({kind:'progress',progress:Math.min(.98,traces.length/Math.max(1,total)),message:`Range ${index+1}/${ranges.length} · ${traces.length.toLocaleString()} of ${total.toLocaleString()} selected frames`});
      }finally{sample.close();}
    }
  }
  return analyzeTraces(info,traces,{...request,ranges});
}
self.onmessage=async({data})=>{
  const {id,kind}=data;
  try{
    const value=kind==='open'?await open(data.file):kind==='preview'?await preview(data.request):kind==='analyze'?await analyze(data.file,data.request):null;
    postMessage({id,value},value?.image?[value.image]:[]);
  }catch(error){postMessage({id,error:error.message||String(error)});}
};
