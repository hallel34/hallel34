# Phase C token plan (landscape/desktop + modals, settings, reports, glossary)

Written before styling. Uses only the existing token layer (tokens.css, redesign block); no new colours.

| Need | Token | Rule |
|---|---|---|
| Surface of a sheet / dialog | `--surface`, `--border`, radius `--r-sheet` (24), shadow `--elev-3` (sheet) / `--elev-4` (dialog) | one surface per layer; the scrim does the separation |
| Rows inside a layer (settings, glossary, report lines) | hairline `1px var(--border)` between rows, no box per row | removes the "stack of identical cards" look |
| The ONE bold element | the layer's gold action (`--sel-gold` fill, ink text) where one exists; otherwise the title (`--fs-h2`, 700) | everything else is text-muted / hairline |
| Titles | `--fs-h2` 20/700, `text-align: start` | no letter-spacing, no justify, no hyphenation (Hebrew) |
| Numbers | existing `money()` bdi dir=ltr, tabular | unchanged |
| Close | 48px hit, 40px quiet disc (existing `.icon-btn`) | unchanged |
| Motion | existing layer enter/exit only (opacity/transform), reduced-motion collapses | no new animation |
| Wide layout | `--panel-w` 340-420px, app column up to 1180px, board = full height x aspect | board geometry untouched; only `--scene-w` changes |

Screens: landscape/desktop board and home (two columns), picker (4 columns), then modals (surface), settings and how-to (flat rows), report (flat blocks), glossary (flat list, quiet "new" tag).
