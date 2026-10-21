export const rangeColors=['#76b9e8','#b49be5','#e5a675','#da92b1','#87c8bc','#c8c47f'];
export const rangeColor=i=>rangeColors[i%rangeColors.length];
export function constrainView(view,duration,minSpan=.02){
  const span=Math.min(duration,Math.max(Math.min(minSpan,duration),view[1]-view[0]));
  const start=Math.max(0,Math.min(duration-span,view[0]));return [start,start+span];
}
export function zoomView(view,duration,factor,anchor=.5,minSpan=.02){
  const center=view[0]+(view[1]-view[0])*anchor,span=(view[1]-view[0])*factor;
  return constrainView([center-span*anchor,center+span*(1-anchor)],duration,minSpan);
}
const $=id=>document.getElementById(id);
const time=t=>{const m=Math.floor(Math.max(0,t)/60);return `${String(m).padStart(2,'0')}:${(Math.max(0,t)%60).toFixed(2).padStart(5,'0')}`;};
export class Timeline {
  constructor(state,seek,getRanges){
    this.s=state;this.seek=seek;this.getRanges=getRanges;this.drag=null;
    $('zoomIn').onclick=()=>this.zoom(.5);$('zoomOut').onclick=()=>this.zoom(2);$('fullGraph').onclick=()=>this.setView([0,this.s.info?.duration||1]);
    $('panLeft').onclick=()=>this.pan(-.5);$('panRight').onclick=()=>this.pan(.5);
    $('plot').addEventListener('wheel',e=>{if(!this.s.info)return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();
      if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))this.pan((e.deltaX||e.deltaY)/rect.width);
      else this.zoom(Math.exp(Math.max(-1,Math.min(1,e.deltaY*.002))),(e.clientX-rect.left)/rect.width);},{passive:false});
    $('plot').onpointerdown=e=>{if(!this.s.info)return;this.drag={x:e.clientX,view:this.view(),kind:'plot'};e.currentTarget.setPointerCapture(e.pointerId);};
    $('plot').onpointermove=e=>{if(this.drag?.kind!=='plot')return;const r=e.currentTarget.getBoundingClientRect(),v=this.drag.view,delta=(e.clientX-this.drag.x)/r.width*(v[1]-v[0]);this.setView([v[0]-delta,v[1]-delta]);};
    $('plot').onpointerup=e=>{if(this.drag?.kind!=='plot')return;if(Math.abs(e.clientX-this.drag.x)<3){const r=e.currentTarget.getBoundingClientRect(),v=this.view();this.seek(v[0]+Math.max(0,Math.min(1,(e.clientX-r.left-38)/(r.width-50)))*(v[1]-v[0]));}this.drag=null;};
    $('plot').onpointercancel=()=>this.drag=null;
    $('plot').onkeydown=e=>{if(['+','=','-','ArrowLeft','ArrowRight','Home'].includes(e.key))e.preventDefault();if(e.key==='+'||e.key==='=')this.zoom(.5);if(e.key==='-')this.zoom(2);if(e.key==='ArrowLeft')this.pan(-.2);if(e.key==='ArrowRight')this.pan(.2);if(e.key==='Home')this.setView([0,this.s.info?.duration||1]);};
    $('overviewTrack').ondblclick=e=>{if(!this.s.info||e.target.closest('#analysisWindow'))return;const r=e.currentTarget.getBoundingClientRect(),t=(e.clientX-r.left)/r.width*this.s.info.duration,range=this.getRanges().find(([a,b])=>a<=t&&t<=b);if(range)this.setView(range);};
    $('scrubber').onkeydown=e=>{if(!this.s.info)return;let t=null;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.seek(this.s.position,e.key==='ArrowLeft'?-1:1);return;}if(e.key==='Home')t=0;if(e.key==='End')t=this.s.info.duration;if(e.key==='PageUp')t=this.s.position+5;if(e.key==='PageDown')t=this.s.position-5;if(t!==null){e.preventDefault();this.seek(t);}};
    $('analysisWindow').onpointerdown=e=>{if(!this.s.info)return;e.stopPropagation();this.drag={x:e.clientX,view:this.view(),kind:e.target.dataset.handle||'window'};e.currentTarget.setPointerCapture(e.pointerId);};
    $('analysisWindow').onpointermove=e=>{if(!this.drag||this.drag.kind==='plot')return;const duration=this.s.info.duration,v=this.drag.view,d=(e.clientX-this.drag.x)/$('overviewTrack').clientWidth*duration,min=this.minSpan();
      const next=this.drag.kind==='start'?[Math.max(0,Math.min(v[1]-min,v[0]+d)),v[1]]:this.drag.kind==='end'?[v[0],Math.min(duration,Math.max(v[0]+min,v[1]+d))]:[v[0]+d,v[1]+d];this.setView(next);};
    $('analysisWindow').onpointerup=e=>{if(this.drag&&Math.abs(e.clientX-this.drag.x)<3){const r=$('overviewTrack').getBoundingClientRect();this.seek((e.clientX-r.left)/r.width*this.s.info.duration);}this.drag=null;};
    $('analysisWindow').onpointercancel=()=>this.drag=null;
    $('analysisWindow').onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const dir=e.key==='ArrowLeft'?-1:1,v=this.view(),d=(v[1]-v[0])*.1,kind=e.target.dataset.handle;
      this.setView(kind==='start'?[Math.max(0,Math.min(v[1]-this.minSpan(),v[0]+d*dir)),v[1]]:kind==='end'?[v[0],Math.min(this.s.info.duration,Math.max(v[0]+this.minSpan(),v[1]+d*dir))]:[v[0]+d*dir,v[1]+d*dir]);};
  }
  minSpan(){return this.s.info?Math.max(.01,4/this.s.info.fps):.1;}
  view(){return this.s.graphRange||[0,this.s.info?.duration||1];}
  setView(view){if(!this.s.info)return;this.s.graphRange=constrainView(view,this.s.info.duration,this.minSpan());this.refresh();}
  zoom(factor,anchor=.5){if(this.s.info)this.setView(zoomView(this.view(),this.s.info.duration,factor,anchor,this.minSpan()));}
  pan(fraction){const [a,b]=this.view(),d=(b-a)*fraction;this.setView([a+d,b+d]);}
  center(t){const [a,b]=this.view();this.setView([t-(b-a)/2,t+(b-a)/2]);}
  refresh(){this.overview();this.plot();}
  overview(){
    const {info,ranges,position}=this.s,loaded=Boolean(info);for(const id of ['zoomIn','zoomOut','panLeft','panRight','fullGraph'])$(id).disabled=!loaded;
    $('overviewEmpty').hidden=loaded;$('overviewContent').hidden=!loaded;if(!loaded)return;
    const d=info.duration,[a,b]=this.view();$('viewTime').textContent=`${time(a)} – ${time(b)}`;$('zoomLevel').textContent=`${(d/(b-a)).toFixed(1)}×`;
    $('analysisWindow').style.left=100*a/d+'%';$('analysisWindow').style.width=100*(b-a)/d+'%';$('analysisWindow').setAttribute('aria-label',`Analysis view ${time(a)} to ${time(b)}. Drag to move.`);
    $('scrubber').setAttribute('aria-valuetext',`${time(position)} of ${time(d)}`);$('overviewRuler').replaceChildren();
    for(let i=0;i<=4;i++){const label=document.createElement('span');label.textContent=time(i*d/4);$('overviewRuler').append(label);}
    const bands=$('overviewBands');bands.replaceChildren();
    this.getRanges().forEach(([start,end],i)=>{const label=ranges.length?'Range '+(i+1):start===0&&Math.abs(end-d)<.05?'Full video':'Selected range';const button=document.createElement('span');button.className='range-band';button.style.left=100*start/d+'%';button.style.width=100*(end-start)/d+'%';button.style.setProperty('--range',rangeColor(i));button.textContent=ranges.length?`R${i+1}`:label;button.title=`${label}: ${time(start)} – ${time(end)}. Double-click to zoom.`;button.setAttribute('aria-label',button.title);bands.append(button);});
  }
  plot(){
    const canvas=$('plot'),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
    const c=canvas.getContext('2d');c.scale(dpr,dpr);const w=rect.width,h=rect.height;if(!this.s.info)return;
    const [a,b]=this.view(),x0=38,x1=w-12,y0=12,y1=h-26,x=t=>x0+(t-a)/(b-a)*(x1-x0),y=v=>y1-v/255*(y1-y0);
    if(x1<=x0||y1<=y0)return;
    c.save();c.beginPath();c.rect(x0,y0,x1-x0,y1-y0);c.clip();c.fillStyle='#101013';c.fillRect(x0,y0,x1-x0,y1-y0);
    const ranges=this.s.result?this.s.result.report.gui.playback_ranges.map(r=>[r.start,r.end]):this.getRanges();
    ranges.forEach(([start,end],i)=>{const left=Math.max(a,start),right=Math.min(b,end);if(right<=left)return;c.fillStyle=rangeColor(i)+'18';c.fillRect(x(left),y0,x(right)-x(left),y1-y0);c.fillStyle=rangeColor(i);c.fillRect(x(left),y0,x(right)-x(left),2);});
    c.restore();c.font='11px Segoe UI';
    for(const value of [0,64,128,192,255]){c.strokeStyle='#34343b';c.beginPath();c.moveTo(x0,y(value));c.lineTo(x1,y(value));c.stroke();c.fillStyle='#a9a9b5';c.textAlign='right';c.fillText(value,x0-7,y(value)+3);}
    for(let i=0;i<5;i++){c.textAlign=i===0?'left':i===4?'right':'center';c.fillStyle='#aaaab5';c.fillText(time(a+(b-a)*i/4),x(a+(b-a)*i/4),h-6);}
    c.save();c.beginPath();c.rect(x0,y0,x1-x0,y1-y0);c.clip();
    if(this.s.result)for(const [field,color,dash] of [['monitor_luma','#72db9c',[]],['lens_luma','#eeb36a',[5,3]]]){
      c.strokeStyle=color;c.lineWidth=1.5;c.setLineDash(dash);c.beginPath();let prior=null;
      const rows=this.s.result.traces;
      for(let i=0;i<rows.length;i++){const t=rows[i];if(!t.in_analysis||t.playback_seconds<a||t.playback_seconds>b){prior=null;continue;}
        if(prior!==t.range_id)c.moveTo(x(t.playback_seconds),y(t[field]));else c.lineTo(x(t.playback_seconds),y(t[field]));prior=t.range_id;}
      c.stroke();}
    const threshold=this.s.result?.report.settings.brightness_threshold;
    if(threshold!==null&&threshold!==undefined){c.setLineDash([6,4]);c.strokeStyle='#bdabd9';c.beginPath();c.moveTo(x0,y(threshold));c.lineTo(x1,y(threshold));c.stroke();c.fillStyle='#e1d5f4';c.textAlign='right';c.fillText('Threshold '+threshold,x1-5,Math.max(y0+12,y(threshold)-5));}
    c.setLineDash([3,3]);c.strokeStyle='#e6e6ec';c.beginPath();c.moveTo(x(this.s.position),y0);c.lineTo(x(this.s.position),y1);c.stroke();c.restore();
  }
}
