# Glass2Glass Video Analyzer

A generic, English-language optical delay tool that runs entirely in the browser.

[Open the webapp](https://pierluigizagaria.github.io/glass2glass-video-analyzer/) in current Chrome or Edge.
For offline use, download `docs/index.html` from this repository and open it locally.
The local project also builds **Glass2Glass Video Analyzer.html** one folder above.
The HTML includes all scripts, styles and worker code: no Python, backend,
installation, account, CDN or network connection is required. It can also be
served unchanged by any static HTTPS host. Codec support depends on the browser;
unsupported codecs produce an actionable error rather than silently skipping frames.

## Workflow

1. **Open video** or drop a local recording onto the page. Nothing is uploaded.
2. Select **Reference** and **Output** regions. Draw in the preview or enter
   `x, y, width, height` under **Pixel coordinates** and press Enter. Coordinates
   refer to the original unrotated decoded frame. Click selects a 12 × 12 region.
3. Add valid ranges in playback time. Each range has its own color; gaps are
   excluded. Overlapping or touching ranges merge. Without an explicit list,
   analysis uses the From–To fields.
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
6. **Analyze video** runs decode and matching in a Web Worker. The preview and
   timeline remain interactive. Cancel terminates the worker immediately.
7. Inspect transitions or per-range statistics. **Export** downloads one ZIP
   containing `report.json`, `pairs.csv`, `ranges.csv`, and `luminance.csv`.

## One navigation timeline

**Timeline** combines the playback cursor, frame controls, colored valid ranges
and analysis viewport in one fixed full-recording control. Drag the cursor or
click anywhere in the colored track to seek. Double-click within a range to zoom
the signal view to it. Drag the outlined view window to pan, or either handle to
resize. Range colors remain fixed across the entire recording, even before analysis.

**Signals** is the detailed analysis view. Wheel to zoom around the cursor, drag
horizontally to pan, Shift+wheel to pan, or use the + / − and arrow buttons.
Click to seek. **Fit all** restores the complete recording. With the plot focused,
+ / − zoom, Left/Right pan and Home fits all. The whole-video timeline never
changes scale when zooming the plot. A result row zooms to that transition.

Outside the plot, Left/Right step frames, I/O mark range start/end, Ctrl+O opens
a recording, and Esc cancels analysis. The inspector scrolls independently.

## Changing settings

Results are a snapshot of the last completed analysis. Editing regions, ranges,
timing, matching settings or brightness threshold keeps the previous results
and curves visible. **Update analysis** starts the replacement calculation.
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
