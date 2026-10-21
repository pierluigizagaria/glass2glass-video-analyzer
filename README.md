# Glass2Glass Video Analyzer

A generic, English-language optical delay tool that runs entirely in the browser.

[Open the webapp](https://pierluigizagaria.github.io/glass2glass-video-analyzer/) in current Chrome or Edge.
For offline use, download `docs/index.html` from this repository and open it locally.
The local project also builds **Glass2Glass Video Analyzer.html** one folder above.
The HTML includes all scripts, styles and worker code: no Python, backend,
installation, account, CDN or network connection is required. It can also be
served unchanged by any static HTTPS host. Codec support depends on the browser;
unsupported codecs produce an actionable error rather than silently skipping frames.

[Buy me a coffee](https://buymeacoffee.com/pierluigizagaria)

Drag the divider beside the Inspector to change its width, or the divider above
Signals to change the graph height. Focus a divider and use arrow keys for precise
adjustments (Shift makes larger steps). Double-click it or press Home to restore
its default size. The browser remembers panel sizes locally; video and measurement
data are not saved by this preference. On narrow screens the Inspector stacks below
the video, while the Signals height remains adjustable.

## Recording target

Choose **Recording target** in the top bar to fill the browser tab with a large
black/white patch, elapsed timer and unique source-event IDs. This follows the
optical test source's format: alternating levels at irregular 100–250 ms intervals.
Choose a take duration and press **Start**; a three-second countdown gives you time
to position the camera. Film the source display and the delayed output together,
then open that recording in the analyzer and select plain areas inside both patches.

**Stop** or Escape ends the sequence. Switching back to the analyzer preserves the
loaded video, ranges and results. The target stops if the tab is hidden or the
display stalls, so a suspended animation cannot silently continue a take. The timer
and event IDs identify content; browser draw times are not photon timestamps and
are not used to calculate latency. No webcam, capture device or streaming service
is started by this section.

## Workflow

1. **Open video** or drop a local recording onto the page. Nothing is uploaded.
2. Select **Reference** and **Output** regions. Draw in the preview or enter
   `x, y, width, height` under **Pixel coordinates** and press Enter. Coordinates
   refer to the original unrotated decoded frame. Click selects a 12 × 12 region.
3. Select a segment with the zoom handles and choose **Add range**. From and To
   update while zooming, panning or resizing. Editing these fields updates the
   selection too. Each added range has its own color; gaps are
   excluded. Overlapping or touching ranges merge. Add at least one range before
   analyzing. Only added ranges are measured; the zoom selection is a draft until added.
4. Recording timing defaults to **Auto (metadata)** when an explicit capture
   FPS tag is found. Supported tag: `com.android.capture.fps` (text or binary
   float32). File/playback FPS alone never establishes capture FPS. Auto combines
   the declared acquisition rate with the video's measured/estimated playback
   cadence. Edited or variable-speed clips may require a manual override.
   Choose Unknown for signal curves without absolute delay, or override with
   Real-time, Slow motion or Capture FPS.
5. For **Brightness**, use **Auto per region** or select **Custom value** and
   enter an on/off threshold from **0 to 255**. The value applies to the average
   brightness in both regions, not to individual pixels or the preview image.
   Automatic mode calibrates each region separately. A threshold outside the
   observed dark/light levels can produce no transitions.
6. **Analyze** measures and matches only the added intervals in a Web Worker.
   Frame numbers still refer to the original video. Codec dependency frames may
   be decoded to reach a range, but are not measured or included in the results. The preview and
   timeline remain interactive. Cancel terminates the worker immediately.
7. Use the **Transitions / By range** tabs to switch result views. Arrow keys
   switch tabs without moving the video. **By range** shows independent results for each interval’s own mean, median,
   95th percentile, transition count and average frame delay. Each interval shows
   its mean calculation (sum of signed delays divided by accepted transitions).
   Below each calculation, the transition table shows that range's reference and
   output frames, frame delay and milliseconds. Selecting a row inspects the same
   transition as in the overall list; transition numbers stay consistent.
   When no measurements are available, both tabs show the reason directly,
   including which region lacks contrast, and a way to inspect the affected range.
   **Inspect** focuses the graph on that range. The overall summary is hidden in
   this view. **Export** downloads one ZIP
   containing `report.json`, `pairs.csv`, `ranges.csv`, and `luminance.csv`.

## One navigation timeline

The **timeline** keeps frame, zoom, pan and Fit all controls in the row above
a thin, fixed full-recording track showing the cursor, ranges and selection. Drag the cursor or
click anywhere in the colored track to seek. Double-click within a range to zoom
the signal view to it. The translucent zoom selection occupies the same track as the
colored ranges. Straight vertical handles match the playhead height and have separate, generous
hit areas even at high zoom. The selection has no top or bottom border; saved
range bands have square ends.
A red playhead with a pointed head identifies the video position in both the
fixed timeline and the signal graph. Only saved ranges have labels on the track.
Use **Previous range boundary / Next range boundary**, or **Up / Down**, to jump
through each saved range's start and end in chronological order. Navigation stops
at the first and last boundary and keeps the zoom level, panning if needed.
The preview displays the decoded frame at the requested boundary; repeated jumps
advance to the next boundary even when a boundary falls between video frames.
Drag either handle to resize, Shift+drag the track to pan, or
focus the selection and use the arrow keys. Shift+arrow on a handle adjusts
by one playback frame. Adjusting a handle does not move the video playhead. Range colors remain fixed across the entire recording, even before analysis.

**Signals** is the detailed analysis view. Drag its red playhead to scrub the
video without panning; drag the graph background to pan. Mouse pointers distinguish
seeking, resizing and panning. Wheel to zoom around the cursor, drag
horizontally to pan, Shift+wheel to pan, or use the + / − and arrow buttons.
Click to seek. **Fit all** restores the complete recording. With the plot focused,
+ / − zoom, Left/Right pan and Home fits all. The whole-video timeline never
changes scale when zooming the plot. A result row zooms to that transition.

Outside the plot, Left/Right step frames, I/O mark range start/end, Ctrl+O opens
a recording, and Esc cancels analysis. The inspector scrolls independently.

## Changing settings

Results are a snapshot of the last completed analysis. Editing regions, ranges,
timing, matching settings or brightness threshold keeps the previous results
and curves visible. **Analyze** starts the replacement calculation.
The old results remain available, including Export, until a successful new run
replaces them. Cancellation or an error preserves the old results. Opening a
different video clears them. The notice above the plot identifies pending changes.

## Measurement and privacy

The JavaScript engine ports the existing conservative algorithm: 10th/90th
percentile calibration, automatic midpoint or custom brightness crossing brackets,
hysteresis at 10% of the measured contrast on either side of the crossing, two stable frames,
and at least four consecutive irregular transitions. Ambiguous or inverted
matches are rejected. Negative delays remain signed. Each range is calibrated
and matched independently; no pair spans a gap. Overall descriptive statistics
pool accepted pairs, while uncertainty is computed per range.

WebCodecs provides actual frame timestamps and decoded samples. Brightness uses
the native Y plane for supported 8-bit YUV formats; otherwise it uses canvas RGB
with Rec.709 weights. RGB modes use canvas channels. Pixel/color conversion may
differ from PyAV; crossing brackets, not sub-frame brightness interpolation,
determine time. No measurements are fabricated for unknown timing or weak contrast.

File reads, metadata parsing, decoding, matching and ZIP creation all happen
inside the browser. A content security policy blocks network connections. Only
the explicit capture-rate tag is retained from descriptive metadata; GPS and
other private tags are never displayed or exported. Closing the page releases
the file. Export before closing if you want to retain results.

## Build and verification

```powershell
npm ci
npm run build
npm test
```

The build creates `dist/index.html`, `docs/index.html` and
`../Glass2Glass Video Analyzer.html`. GitHub Pages serves the committed `/docs`
directory on `main`; rebuild and commit `docs/index.html` when changing the app. The legacy
Python tools remain available for historical regression checks but are not used
by this webapp or its launcher. `preview.mjs` is an optional development-only
static HTML server, with no APIs or upload endpoint; it is not part of the app.

The portable tests generate 45 irregular transitions with a known 20 ms delay,
then cover excluded gaps, unknown timing, ambiguous periodic sequences, explicit
capture-rate metadata, custom thresholds (including boundaries), zoom bounds,
standalone compilation and result preservation through recalculation/cancel/error.
Three additional regression tests run only when the original private validation
fixtures are available in the parent workspace. Those recordings and traces are
not published. Locally, all 50 archived pairs match the previous Python engine.

## Publishing

This repository contains the browser app only. The generated `docs/index.html`
is the complete deployable artifact and `docs/.nojekyll` disables template processing.
GitHub Pages needs no application server, secrets or video upload service.
GitHub Actions runs the portable test suite on pushes and pull requests.

Dependencies: Mediabunny 1.62.0 (MPL-2.0), fflate 0.8.3 (MIT), esbuild 0.25.12
(MIT, build only). Mediabunny is used unmodified and bundled with its license
notices. Its source is available from https://github.com/Vanilagy/mediabunny.

References: [Mediabunny video samples](https://mediabunny.dev/guide/media-sinks),
[Android capture FPS metadata](https://developer.android.com/reference/androidx/media3/container/MdtaMetadataEntry#KEY_ANDROID_CAPTURE_FPS).
