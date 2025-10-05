## Fix UI

- Place cut direction chevrons at regular intervals around Path
- Add chevrons to Rapid

## From snowgoer

- Fix degree 3 spline offset
- Add developer mode to settings that does this:
  - Developer mode defaults to off
  - Hide Edit and Prepare stages when on
  - Automatically apply when on
    - Decompose Polylines
    - Translate to Positive
    - Detect Chains
    - Normalize Chains
    - Optimize Starts
    - Detect Parts

## Fix

- Get getSplineTangent should use NurbsCurve.tangent(u : Float)
- Spline length should use NurbsCurve.length()
- tessellateWithVerbNurbs ignores requested point count?
- getSplinePointAt should not tesselate the whole point every time
  Use NurbsCurve.point(u : Float)
- Tesselate functions should take a tolerance parameter.
  Sample functions should take a count parameter.

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
