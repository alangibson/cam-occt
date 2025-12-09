# Fix

- Move spot duration value to Simulation page. This is set in LinuxCNC config directly.
- Hole underspeed should be available for isCyclic chains
- Persist cuts to local storage or rebuild on refresh
- Changing Application Measurement Units does nothing after Import clicked
- Bring back kerf visualization
- Replace TSP with deterministic 3rd party library
- Settings page should always be available no matter what for Application Reset

## Fix UI

- Enable hole underspeed should be available when creating operations on chains, not just parts
- Don't automatically Apply To when creating other than first operation
- hover highlighting doesnt work on shapes
- Place cut direction chevrons at regular intervals around Path
- Add chevrons to Rapid
- Dont display "Shapes in Chain" in InspectPanel for Chain type

## Features

- Add option to cut holes first
- Add button and parameters for cut order optimization
- Register domain name or create subdomain and direct to Cloudflare Worker
- Automatically align lead direction with cut direction
- Add easy mode
  - Add checkbox on Input screen
  - Add tool selection dropdown when checked on Input screen
  - Skip Edit stage
  - Apply all on Prepare stage
  - Add operation for each part and each chain on Program stage
  - Start simulation in Simulation stage
- Support SVG import
- Display test DXF files on Import screen
- Add multiselect to parts and chains
- Drag to select shapes, chains, parts, etc.
- Detect self intersections in offsets and trim
- Undo in Edit state
- Add part packing stage named Pack
- Show gcode being executed in simulation
- Add ability to delete layer in Edit stage
- Allow user to manually edit offsets (add Tweak stage?)
- Add manual feed override factor to operations
- Force close offsets where intersection is impossible.
  Example: polyline-pill.dxf part 3 with 2 concave arcs

## Refactor

- Merge all 'function getShapePoints'
- Merge all 'function calculatePolygonCentroid'
- Merge all 'function validateSplineGeometry'
- Merge all 'function calculateEllipsePoint'
- Function Math.atan2 is used a lot. Create wrapper functions?
- Get rid of convertLeadGeometryToPoints() and use Arc|Line instead of points
- Replace evaluateNURBS with getSplinePointAt
- Decompose getShapePoints into functions

## Usability

- Expose offset calculation settings to user
- Remove "Generated G-Code" text from Export stage page
- Remove color from toolbar buttons in Export stage page
- Add Clear buttons for all remaining Prepare actions
- Add link to Help forum

## Fixes

- Cut Direction of holes that are Circle geometries do not change when set in Operation
- In DOGLABPLAQUE.dxf Join Co-linear lines removes tops of arrows
- DRAAK.dxf is loaded as blank drawing (fix-draak-twitching)

### Polyline

- Outer offset of ADLER.dxf chain 5 is degenerate when it stays a polyline
- Chain 3 arcs in polyline-pill.dxf are lines when they remain a polyline
