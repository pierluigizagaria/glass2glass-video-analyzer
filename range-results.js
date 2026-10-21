import {stats} from './engine.js';

// Derive each result from that range's accepted pairs, never the pooled report.
export function rangeSummaries(report) {
  return (report.ranges || [report]).map((range,index) => {
    const timed = Boolean(range.gui.time_scale_confirmed);
    const samples = timed ? range.samples : [];
    const delays = samples.map(sample => sample.midpoint_ms);
    const distribution = stats(delays);
    return {
      id: range.range_id || index + 1,
      start: range.gui.playback_start,
      end: range.gui.playback_end,
      timed,
      count: samples.length,
      mean: distribution?.mean ?? null,
      median: distribution?.p50 ?? null,
      p95: distribution?.p95 ?? null,
      sum: delays.reduce((total,value) => total + value, 0),
      meanFrames: samples.length ? samples.reduce((total,sample) => total + sample.delay_frames, 0) / samples.length : null,
      ci: range.uncertainty?.ci95_mean_ms ?? null,
      error: range.range_error || null,
    };
  });
}
