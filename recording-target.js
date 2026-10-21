export function* targetEvents(seed=43){
  let random=seed>>>0,id=0;
  while(true){
    random=(Math.imul(random,1664525)+1013904223)>>>0;
    id++;
    yield {id,level:id%2,dwellMs:100+Math.floor(random/4294967296*151)};
  }
}

const $=id=>document.getElementById(id);
const elapsedText=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${(Math.floor(ms)%60000/1000).toFixed(3).padStart(6,'0')}`;

export class RecordingTarget {
  constructor(onModeChange=()=>{}){
    this.onModeChange=onModeChange;this.running=false;this.elapsed=0;
    $('recordingMode').onclick=()=>this.show(!this.active);
    $('targetStart').onclick=()=>this.start();$('targetStop').onclick=()=>this.stop('Stopped');
    $('targetReset').onclick=()=>this.reset();
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.running)this.stop('Interrupted — keep this tab visible during recording.');});
    document.addEventListener('keydown',e=>{if(this.active&&e.key==='Escape'&&this.running){e.preventDefault();this.stop('Stopped');}});
  }
  get active(){return document.body.dataset.mode==='recording';}
  show(active){
    if(!active&&this.running)this.stop('Stopped');
    document.body.dataset.mode=active?'recording':'analysis';
    $('analyzerWorkspace').hidden=active;$('recordingWorkspace').hidden=!active;$('recordingControls').hidden=!active;
    $('recordingMode').textContent=active?'Back to analyzer':'Recording target';
    $('recordingMode').setAttribute('aria-pressed',String(active));
    this.onModeChange();
  }
  reset(){
    this.stop('Ready — start your camera, then start the target.');this.elapsed=0;
    $('targetTimer').textContent='00:00.000';$('targetEvent').textContent='S000000000000';
  }
  start(){
    if(this.running)return;
    this.elapsed=0;this.events=targetEvents();this.next=this.events.next().value;
    this.duration=Number($('targetDuration').value)*1000;this.countdownEnd=performance.now()+3000;
    this.started=null;this.running=true;
    $('targetStart').hidden=true;$('targetStop').hidden=false;$('targetReset').disabled=true;$('targetDuration').disabled=true;
    $('targetTimer').textContent='00:00.000';$('targetEvent').textContent='S000000000000';$('targetPatch').classList.remove('lit');
    $('targetState').textContent='Starting in 3 seconds…';$('targetCountdown').hidden=false;
    $('targetStop').focus({preventScroll:true});this.frame=requestAnimationFrame(now=>this.tick(now));
  }
  tick(now){
    if(!this.running)return;
    if(now<this.countdownEnd){$('targetCountdown').textContent=String(Math.ceil((this.countdownEnd-now)/1000));}
    else{
      if(this.started===null){this.started=now;this.previousFrame=now;this.nextAt=now+this.next.dwellMs;$('targetCountdown').hidden=true;$('targetState').textContent='Running · Esc to stop';}
      if(now-this.previousFrame>500){this.stop('Interrupted — the display stalled. Start a fresh take.');return;}
      this.previousFrame=now;this.elapsed=Math.min(this.duration,now-this.started);$('targetTimer').textContent=elapsedText(this.elapsed);
      if(this.elapsed>=this.duration){this.stop('Complete — open the camera recording in the analyzer.');return;}
      if(now>=this.nextAt){
        $('targetPatch').classList.toggle('lit',Boolean(this.next.level));
        $('targetEvent').textContent=`S${String(this.next.id).padStart(12,'0')}`;
        this.next=this.events.next().value;this.nextAt=now+this.next.dwellMs;
      }
    }
    this.frame=requestAnimationFrame(next=>this.tick(next));
  }
  stop(message){
    this.running=false;cancelAnimationFrame(this.frame);
    $('targetPatch').classList.remove('lit');$('targetCountdown').hidden=true;
    $('targetStart').hidden=false;$('targetStop').hidden=true;$('targetReset').disabled=false;$('targetDuration').disabled=false;
    $('targetState').textContent=message;
  }
}
