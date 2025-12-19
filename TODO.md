# Milestones

## v0.?.0

- Open multiple drawings

## v0.?.0

- Manual packing

- Add 3rd party TSP algorithm

## v0.?.0

- Support multiple gcode preprocessors

- Show gcode being executed in simulation
- Move spot duration value to Simulation page. This is set in LinuxCNC config directly.

## v0.4.0

- Support SVG import

- Stable tool table storage JSON w/ JSONSchema definition
- Display test DXF files on Import screen

# Fix

- Persist cuts to local storage or rebuild on refresh
- Changing Application Measurement Units does nothing after Import clicked
- Bring back kerf visualization
- Replace TSP with deterministic 3rd party library
- Settings page should always be available no matter what for Application Reset
- Don't automatically Apply To when creating other than first operation
- hover highlighting doesnt work on shapes
- Place cut direction chevrons at regular intervals around Path

## Features

- Option to disable and delete layers
- Drag to select
- Detect self intersections in offsets and trim
- Add ability to delete layer in Edit stage
- Allow user to manually edit offsets (add Tweak stage?)
- Add manual feed override factor to operations
- Force close offsets where intersection is impossible.
  Example: polyline-pill.dxf part 3 with 2 concave arcs

## Usability

- Expose offset calculation settings to user
- Remove "Generated G-Code" text from Export stage page
- Remove color from toolbar buttons in Export stage page
- Add Clear buttons for all remaining Prepare actions
- Add link to Help forum

### Polyline

- Outer offset of ADLER.dxf chain 5 is degenerate when it stays a polyline
- Chain 3 arcs in polyline-pill.dxf are lines when they remain a polyline
