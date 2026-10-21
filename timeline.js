export const rangeColors=['#76b9e8','#b49be5','#e5a675','#da92b1','#87c8bc','#c8c47f'];
export const rangeColor=i=>rangeColors[i%rangeColors.length];
const playheadColor='#f05b61';
export function rangeBoundary(ranges,position,direction){
  const edges=[...new Set(ranges.flat())].sort((a,b)=>a-b);
  return direction<0?edges.filter(t=>t<position-1e-7).at(-1)??null:edges.find(t=>t>position+1e-7)??null;
}
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
  constructor(state,seek,getRanges,onViewChange=()=>{}){
    this.s=state;this.seek=seek;this.getRanges=getRanges;this.onViewChange=onViewChange;this.drag=null;
    $('zoomIn').onclick=()=>this.zoom(.5);$('zoomOut').onclick=()=>this.zoom(2);$('fullGraph').onclick=()=>this.setView([0,this.s.info?.duration||1]);
    $('panLeft').onclick=()=>this.pan(-.5);$('panRight').onclick=()=>this.pan(.5);
    $('previousBoundary').onclick=()=>this.jumpBoundary(-1);$('nextBoundary').onclick=()=>this.jumpBoundary(1);
    document.addEventListener('keydown',e=>{
      if(document.body.dataset.mode==='recording'||!['ArrowUp','ArrowDown'].includes(e.key)||e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input:not(#scrubber),select,textarea,[contenteditable="true"]')||$('helpDialog').open)return;
      if(!this.s.info||!this.getRanges().length)return;e.preventDefault();this.jumpBoundary(e.key==='ArrowUp'?-1:1);
    });
    $('plot').addEventListener('wheel',e=>{if(!this.s.info)return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();
      if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))this.pan((e.deltaX||e.deltaY)/rect.width);
      else this.zoom(Math.exp(Math.max(-1,Math.min(1,e.deltaY*.002))),(e.clientX-rect.left)/rect.width);},{passive:false});
    $('plot').onpointerdown=e=>{if(!this.s.info||e.button!==0)return;const kind=this.nearPlayhead(e)?'playhead':'plot';this.drag={x:e.clientX,view:this.view(),kind};e.currentTarget.style.cursor=kind==='playhead'?'ew-resize':'grabbing';e.currentTarget.setPointerCapture(e.pointerId);};
    $('plot').onpointermove=e=>{if(this.drag?.kind==='playhead'){this.seekPlot(this.plotTime(e));return;}if(this.drag?.kind==='plot'){const r=e.currentTarget.getBoundingClientRect(),v=this.drag.view,delta=(e.clientX-this.drag.x)/r.width*(v[1]-v[0]);this.setView([v[0]-delta,v[1]-delta]);return;}e.currentTarget.style.cursor=this.nearPlayhead(e)?'ew-resize':'grab';};
    $('plot').onpointerup=e=>{if(!['plot','playhead'].includes(this.drag?.kind))return;const scrubbed=this.drag.kind==='playhead';if(scrubbed)this.seekPlot(this.plotTime(e),true);else if(Math.abs(e.clientX-this.drag.x)<3)this.seek(this.plotTime(e));this.drag=null;e.currentTarget.style.cursor=scrubbed||this.nearPlayhead(e)?'ew-resize':'grab';};
    $('plot').onpointercancel=e=>{clearTimeout(this.plotSeekTimer);this.plotSeekTimer=null;this.drag=null;e.currentTarget.style.cursor='grab';};
    $('plot').onkeydown=e=>{if(['+','=','-','ArrowLeft','ArrowRight','Home'].includes(e.key))e.preventDefault();if(e.key==='+'||e.key==='=')this.zoom(.5);if(e.key==='-')this.zoom(2);if(e.key==='ArrowLeft')this.pan(-.2);if(e.key==='ArrowRight')this.pan(.2);if(e.key==='Home')this.setView([0,this.s.info?.duration||1]);};
    $('overviewTrack').ondblclick=e=>{if(!this.s.info||e.target.closest('#analysisWindow'))return;const r=e.currentTarget.getBoundingClientRect(),t=(e.clientX-r.left)/r.width*this.s.info.duration,range=this.getRanges().find(([a,b])=>a<=t&&t<=b);if(range)this.setView(range);};
    $('scrubber').onkeydown=e=>{if(!this.s.info)return;let t=null;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.seek(this.s.position,e.key==='ArrowLeft'?-1:1);return;}if(e.key==='Home')t=0;if(e.key==='End')t=this.s.info.duration;if(e.key==='PageUp')t=this.s.position+5;if(e.key==='PageDown')t=this.s.position-5;if(t!==null){e.preventDefault();this.seek(t);}};
    const track=$('overviewTrack');
    $('scrubber').addEventListener('pointermove',e=>{if(!this.s.info)return;const r=track.getBoundingClientRect(),px=r.left+this.s.position/this.s.info.duration*r.width;e.currentTarget.classList.toggle('at-playhead',Math.abs(e.clientX-px)<=9);});
    document.addEventListener('keydown',e=>{if(e.key==='Shift')track.classList.add('pan-ready');});
    document.addEventListener('keyup',e=>{if(e.key==='Shift')track.classList.remove('pan-ready');});
    window.addEventListener('blur',()=>track.classList.remove('pan-ready'));
    track.addEventListener('pointerdown',e=>{if(!this.s.info||!e.shiftKey||e.target.closest('[data-handle]'))return;e.preventDefault();e.stopPropagation();this.drag={x:e.clientX,view:this.view(),kind:'window'};track.setPointerCapture(e.pointerId);track.classList.add('panning');},true);
    track.addEventListener('pointermove',e=>{if(this.drag?.kind!=='window'||!track.hasPointerCapture(e.pointerId))return;const v=this.drag.view,d=(e.clientX-this.drag.x)/track.clientWidth*this.s.info.duration;this.setView([v[0]+d,v[1]+d]);});
    const finishPan=e=>{if(!track.hasPointerCapture(e.pointerId))return;track.releasePointerCapture(e.pointerId);track.classList.remove('panning');this.drag=null;};
    track.addEventListener('pointerup',finishPan);track.addEventListener('pointercancel',finishPan);
    $('analysisWindow').onpointerdown=e=>{if(!this.s.info||e.button!==0)return;e.preventDefault();e.stopPropagation();const handle=e.target.closest('[data-handle]');handle?.focus({preventScroll:true});handle?.classList.add('dragging');this.drag={x:e.clientX,view:this.view(),kind:handle?.dataset.handle||'window'};e.currentTarget.setPointerCapture(e.pointerId);};
    $('analysisWindow').onpointermove=e=>{if(!this.drag||this.drag.kind==='plot')return;const duration=this.s.info.duration,v=this.drag.view,d=(e.clientX-this.drag.x)/$('overviewTrack').clientWidth*duration,min=this.minSpan();
      const next=this.drag.kind==='start'?[Math.max(0,Math.min(v[1]-min,v[0]+d)),v[1]]:this.drag.kind==='end'?[v[0],Math.min(duration,Math.max(v[0]+min,v[1]+d))]:[v[0]+d,v[1]+d];this.setView(next);};
    const finishResize=e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);for(const handle of e.currentTarget.querySelectorAll('[data-handle]'))handle.classList.remove('dragging');this.drag=null;};
    $('analysisWindow').onpointerup=finishResize;
    $('analysisWindow').onpointercancel=finishResize;
    $('analysisWindow').onkeydown=e=>{if(!this.s.info||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const dir=e.key==='ArrowLeft'?-1:1,v=this.view(),d=e.shiftKey?1/this.s.info.fps:(v[1]-v[0])*.1,kind=e.target.dataset.handle;
      this.setView(kind==='start'?[Math.max(0,Math.min(v[1]-this.minSpan(),v[0]+d*dir)),v[1]]:kind==='end'?[v[0],Math.min(this.s.info.duration,Math.max(v[0]+this.minSpan(),v[1]+d*dir))]:[v[0]+d*dir,v[1]+d*dir]);};
  }
  minSpan(){return this.s.info?Math.max(.01,4/this.s.info.fps):.1;}
  plotTime(e){const r=$('plot').getBoundingClientRect(),[a,b]=this.view();return a+Math.max(0,Math.min(1,(e.clientX-r.left-38)/(r.width-50)))*(b-a);}
  nearPlayhead(e){if(!this.s.info)return false;const r=$('plot').getBoundingClientRect(),[a,b]=this.view(),t=this.s.position;return t>=a&&t<=b&&Math.abs(e.clientX-(r.left+38+(t-a)/(b-a)*(r.width-50)))<=9;}
  seekPlot(t,flush=false){this.plotSeekTime=t;if(flush){clearTimeout(this.plotSeekTimer);this.plotSeekTimer=null;this.seek(t);}else if(!this.plotSeekTimer)this.plotSeekTimer=setTimeout(()=>{this.plotSeekTimer=null;this.seek(this.plotSeekTime);},80);}
  view(){return this.s.graphRange||[0,this.s.info?.duration||1];}
  setView(view){if(!this.s.info)return;this.s.graphRange=constrainView(view,this.s.info.duration,this.minSpan());this.onViewChange(this.s.graphRange);this.refresh();}
  zoom(factor,anchor=.5){if(this.s.info)this.setView(zoomView(this.view(),this.s.info.duration,factor,anchor,this.minSpan()));}
  pan(fraction){const [a,b]=this.view(),d=(b-a)*fraction;this.setView([a+d,b+d]);}
  center(t){const [a,b]=this.view();this.setView([t-(b-a)/2,t+(b-a)/2]);}
  jumpBoundary(direction){
    if(!this.s.info||this.s.seeking)return;
    const target=rangeBoundary(this.getRanges(),this.s.boundaryTarget??this.s.position,direction);
    if(target===null)return;
    const [a,b]=this.view();if(target<a||target>b)this.center(target);
    this.seek(target,0,true);
  }
  refresh(){this.overview();this.plot();}
  overview(){
    const {info,ranges,position}=this.s,loaded=Boolean(info);for(const id of ['zoomIn','zoomOut','panLeft','panRight','fullGraph'])$(id).disabled=!loaded;
    for(const [id,direction] of [['previousBoundary',-1],['nextBoundary',1]])$(id).disabled=!loaded||rangeBoundary(this.getRanges(),this.s.boundaryTarget??position,direction)===null;
    $('analysisWindow').hidden=!loaded;$('timelinePlayhead').hidden=!loaded;if(!loaded)return;
    const d=info.duration,[a,b]=this.view();$('viewTime').textContent=`${time(a)} – ${time(b)}`;$('zoomLevel').textContent=`${(d/(b-a)).toFixed(1)}×`;
    $('analysisWindow').style.left=100*a/d+'%';$('analysisWindow').style.width=100*(b-a)/d+'%';$('analysisWindow').setAttribute('aria-label',`Analysis view ${time(a)} to ${time(b)}. Shift+drag the track or use arrow keys to pan.`);
    $('scrubber').setAttribute('aria-valuetext',`${time(position)} of ${time(d)}`);$('timelinePlayhead').style.left=100*Math.max(0,Math.min(d,position))/d+'%';$('overviewRuler').replaceChildren();
    for(let i=0;i<=4;i++){const label=document.createElement('span');label.textContent=time(i*d/4);$('overviewRuler').append(label);}
    const bands=$('overviewBands');bands.replaceChildren();
    this.getRanges().forEach(([start,end],i)=>{const label=ranges.length?'Range '+(i+1):start===0&&Math.abs(end-d)<.05?'Full video':'Selected range';const button=document.createElement('span');button.className='range-band';button.style.left=100*start/d+'%';button.style.width=100*(end-start)/d+'%';button.style.setProperty('--range',rangeColor(i));if(ranges.length){const text=document.createElement('span');text.className='range-label';text.textContent=`R${i+1}`;button.append(text);}button.title=`${label}: ${time(start)} – ${time(end)}. Double-click to zoom.`;button.setAttribute('aria-label',button.title);bands.append(button);});
  }
  plot(){
    const canvas=$('plot'),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
    const c=canvas.getContext('2d');c.scale(dpr,dpr);const w=rect.width,h=rect.height;if(!this.s.info)return;
    const [a,b]=this.view(),x0=38,x1=w-12,y0=16,y1=h-26,x=t=>x0+(t-a)/(b-a)*(x1-x0),y=v=>y1-v/255*(y1-y0);
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
    c.restore();
    if(this.s.position>=a&&this.s.position<=b){
      const px=x(this.s.position);c.setLineDash([]);c.strokeStyle=playheadColor;c.lineWidth=2;
      c.beginPath();c.moveTo(px,y0);c.lineTo(px,y1);c.stroke();
      c.fillStyle=playheadColor;c.beginPath();c.moveTo(px-6,y0-10);c.lineTo(px+6,y0-10);c.lineTo(px+6,y0-4);c.lineTo(px,y0);c.lineTo(px-6,y0-4);c.closePath();c.fill();
    }
  }
}
