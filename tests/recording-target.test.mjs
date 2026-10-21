import test from 'node:test';
import assert from 'node:assert/strict';
import {targetEvents} from '../recording-target.js';

test('recording target has reproducible irregular 100–250 ms changes with unique source IDs',()=>{
  const events=targetEvents(),repeated=targetEvents(),different=targetEvents(44);
  const sequence=Array.from({length:300},()=>events.next().value);
  assert.deepEqual(sequence,Array.from({length:300},()=>repeated.next().value));
  assert.notDeepEqual(sequence,Array.from({length:300},()=>different.next().value));
  for(const [i,event] of sequence.entries()){
    assert.equal(event.id,i+1);assert.equal(event.level,(i+1)%2);
    assert.ok(event.dwellMs>=100&&event.dwellMs<=250);
  }
  assert.ok(new Set(sequence.map(e=>e.dwellMs)).size>100);
});
