// Only an explicit acquisition-rate tag is evidence of capture FPS. Nominal or
// measured file FPS alone never enables absolute latency.
export function captureTiming(raw={}) {
  const value=raw['com.android.capture.fps'];
  let fps=null;
  if(typeof value==='number')fps=value;
  else if(typeof value==='string'&&/^\s*\d+(\.\d+)?\s*$/.test(value))fps=Number(value);
  else if(value instanceof Uint8Array&&value.byteLength===4)fps=new DataView(value.buffer,value.byteOffset,4).getFloat32(0,false);
  if(!Number.isFinite(fps)||fps<1||fps>100000)return {capture_fps:null,capture_source:null};
  return {capture_fps:fps,capture_source:'com.android.capture.fps'};
}
