const storageKey='glass2glass.panel-layout.v1';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class PanelLayout {
  constructor(){
    this.main=document.querySelector('main');
    this.workspace=document.querySelector('.workspace');
    this.inspector=document.getElementById('inspector');
    this.signals=document.getElementById('signals');
    this.handles={inspector:document.getElementById('inspectorDivider'),signals:document.getElementById('signalsDivider')};
    this.stacked=matchMedia('(max-width:800px)');
    this.preferred={};
    try{const saved=JSON.parse(localStorage.getItem(storageKey));for(const key of ['inspector','signals'])if(Number.isFinite(saved?.[key]))this.preferred[key]=saved[key];}catch{}
    for(const [key,handle] of Object.entries(this.handles)){
      const coordinate=e=>key==='inspector'?e.clientX:e.clientY;
      handle.onpointerdown=e=>{
        if(e.button!==0||handle.getAttribute('aria-disabled')==='true')return;
        e.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(e.pointerId);
        this.drag={key,start:coordinate(e),size:this.size(key)};
        document.body.dataset.resizing=key;
      };
      handle.onpointermove=e=>{
        if(this.drag?.key!==key||!handle.hasPointerCapture(e.pointerId))return;
        const {min,max}=this.limits(key);
        this.preferred[key]=clamp(this.drag.size+this.drag.start-coordinate(e),min,max);this.refresh();
      };
      const finish=e=>{
        if(!handle.hasPointerCapture(e.pointerId))return;
        handle.releasePointerCapture(e.pointerId);this.drag=null;delete document.body.dataset.resizing;this.save();
      };
      handle.onpointerup=finish;handle.onpointercancel=finish;
      handle.ondblclick=()=>this.reset(key);
      handle.onkeydown=e=>{
        const previous=key==='inspector'?'ArrowLeft':'ArrowUp',next=key==='inspector'?'ArrowRight':'ArrowDown';
        if(![previous,next,'Home'].includes(e.key))return;
        e.preventDefault();e.stopPropagation();
        if(e.key==='Home'){this.reset(key);return;}
        const {min,max}=this.limits(key),step=e.shiftKey?40:10;
        this.preferred[key]=clamp(this.size(key)+(e.key===previous?step:-step),min,max);this.refresh();this.save();
      };
    }
    this.observer=new ResizeObserver(()=>this.refresh());this.observer.observe(this.main);this.observer.observe(this.workspace);
    this.stacked.addEventListener('change',()=>this.refresh());this.refresh();
  }
  size(key){const rect=this[key].getBoundingClientRect();return key==='inspector'?rect.width:rect.height;}
  limits(key){
    if(key==='inspector')return {min:280,max:Math.max(280,Math.min(640,this.main.clientWidth-426))};
    const reserved=this.workspace.querySelector('.viewer-bar').offsetHeight+this.workspace.querySelector('.overview').offsetHeight+this.handles.signals.offsetHeight+170;
    return {min:140,max:Math.max(140,this.workspace.clientHeight-reserved)};
  }
  refresh(){
    for(const [key,handle] of Object.entries(this.handles)){
      const stacked=key==='inspector'&&this.stacked.matches;
      handle.tabIndex=stacked?-1:0;handle.setAttribute('aria-disabled',String(stacked));
      if(stacked)continue;
      const {min,max}=this.limits(key),value=clamp(this.preferred[key]??this.defaultSize(key),min,max);
      this.main.style.setProperty(`--${key}-size`,`${value}px`);
      handle.setAttribute('aria-valuemin',String(min));handle.setAttribute('aria-valuemax',String(Math.round(max)));
      handle.setAttribute('aria-valuenow',String(Math.round(value)));handle.setAttribute('aria-valuetext',`${Math.round(value)} pixels`);
    }
  }
  defaultSize(key){return key==='inspector'?(this.main.clientWidth<=1100?306:330):(innerHeight<=800?190:235);}
  reset(key){delete this.preferred[key];this.refresh();this.save();}
  save(){try{localStorage.setItem(storageKey,JSON.stringify(this.preferred));}catch{}}
}
