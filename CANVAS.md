# Canvas Rendering Refactoring Plan

## Overview

Refactor DrawingCanvas.svelte into a modular, efficient multi-layer rendering pipeline with separate renderers for each object type. This will improve performance, maintainability, and enable efficient partial re-rendering.

## Test-Driven Development Requirements

### Testing Philosophy

- **Write Tests First**: For any new code, write tests that define the expected behavior BEFORE implementing
- **Test Before Moving**: When refactoring existing DrawingCanvas.svelte code, write tests for current behavior first
- **No Test Modification**: Tests define the contract - do not change expectations after moving code unless it's explicitly part of the refactoring plan
- **Base on Existing Code**: Use DrawingCanvas.svelte's existing implementation as the source of truth for types and function signatures

### Testing Strategy

- Each renderer must have a corresponding test file (e.g., `shape.test.ts` for `shape.ts`)
- Test files should cover:
  - Render output correctness
  - Hit detection accuracy
  - State change detection (isDirty)
  - Performance characteristics
- Use existing DrawingCanvas.svelte behavior as test expectations

### Implementation Guidelines

- **Preserve Signatures**: When extracting code from DrawingCanvas.svelte, maintain exact function signatures and types
- **Document Changes**: If refactoring requires interface changes, document why and get approval first
- **Incremental Validation**: Run tests after each extraction to ensure no regression
- **Type Safety**: Never use `never`, `any`, or `unknown` types - always find and use the correct specific type

## Architecture

### Core Components

#### 1. Rendering Pipeline (`src/lib/rendering/canvas/pipeline.ts`)

- **RenderingPipeline**: Main orchestrator for rendering and interaction
  - Manages layer stack and rendering order
  - Coordinates renderer instances
  - Handles render scheduling and optimization
  - Manages canvas context pool for layers
  - Performs hit detection by querying renderers
  - Maintains z-order for both rendering and hit testing

#### 2. Layer System (`src/lib/rendering/canvas/layers/`)

- **LayerManager**: Manages multiple canvas layers with z-ordering
  - Each layer is a separate HTML canvas element
  - Layers are stacked using CSS positioning
  - Dirty tracking per layer for efficient updates
- **Layer Types** (each on its own canvas):
  - `background`: Grid, origin cross, static elements
  - `shapes`: Base geometry shapes
  - `chains`: Chain highlighting and visualization
  - `parts`: Part shells and holes
  - `paths`: Green path highlighting
  - `offsets`: Offset path visualization
  - `leads`: Lead-in/lead-out lines
  - `rapids`: Rapid movement lines
  - `overlays`: Stage-specific overlays
    - `endpoint-overlays`: start and end points
    - `tesselation-overlay`: tessellation points
    - `direction-overlay`: Direction indicators as chevron arrows
    - `tangent-overlay`: shape tangent lead orientation is based on
  - `selection`: Selection highlights (orange)
    - `hover-select`: Hover effects
    - `click-select`: durable selection effects after click by user
  - `interaction`: Hit detection layer (invisible)

#### 3. Renderer Components (`src/lib/rendering/canvas/renderers/`)

Each renderer implements the `Renderer` interface:

```typescript
interface Renderer {
  id: string;
  layer: string;
  render(ctx: CanvasRenderingContext2D, state: RenderState): void;
  hitTest?(point: Point2D, state: RenderState): HitTestResult | null;
  isDirty(state: RenderState, prevState: RenderState): boolean;
}
```

##### Base Renderers:

- **ShapeRenderer**: Renders basic geometry (lines, arcs, circles, etc.)
  - Handles shape styling based on state
  - Implements shape-specific drawing functions
  - Manages shape tessellation and caching
  - Hit tests against actual geometry with distance tolerance

- **ChainRenderer**: Renders chain-related visualization
  - Chain highlighting
  - Chain endpoint markers
  - Chain closure indicators
  - Hit tests for chain selection (all shapes in chain)

- **PartRenderer**: Renders part detection results
  - Part shell outlines
  - Hole visualization
  - Part containment highlighting
  - Point-in-polygon hit testing with hole exclusion

- **PathRenderer**: Renders cutting paths
  - Green path highlighting
  - Path selection states
  - Cut order visualization
  - Hit tests offset shapes with priority over original

- **OffsetRenderer**: Renders offset geometry
  - Original path (dashed)
  - Offset path (solid)
  - Gap fills
  - Offset shape selection
  - Specialized hit detection for offset geometry

- **LeadRenderer**: Renders lead-in/lead-out geometry
  - Lead-in lines (blue)
  - Lead-out lines (red)
  - Arc lead visualization
  - Lead configuration display
  - Hit tests lead geometry for selection

- **RapidRenderer**: Renders rapid movements
  - Dashed blue lines
  - Rapid selection/highlighting
  - Rapid order numbers
  - Simple line segment distance hit testing

- **OverlayRenderer**: Renders stage-specific overlays
  - Shape endpoints (Edit stage)
  - Chain endpoints (Prepare stage)
  - Tessellation points (Program stage)
  - Tool head (Simulate stage)
  - Chevron arrows along paths
  - Spacing calculation
  - Direction interpolation
  - Hit tests for overlay point selection

##### Interactive Renderers:

- **SelectionRenderer**: Renders selection and hover highlighting
  - Orange outlines for selected items
  - Handles multi-selection visualization
  - Selection box rendering
  - Hover highlights
  - Tooltip positioning hints
  - Interactive feedback
  - Marquee selection hit testing

#### 4. Hit Detection

Hit detection is handled directly by the RenderingPipeline, which queries renderers in priority order:

- **RenderingPipeline.hitTest()**: Coordinates hit detection
  - Queries renderers in reverse z-order (top to bottom)
  - Returns first hit from highest priority renderer
  - Each renderer implements its own hit test logic
  - Configurable hit test priority order

- **HitTestResult**: Standardized hit test response

```typescript
interface HitTestResult {
  type: 'shape' | 'chain' | 'part' | 'path' | 'rapid' | 'offset';
  id: string;
  distance: number;
  point: Point2D;
  metadata?: Record<string, unknown>;
}
```

- **Hit Test Priority** (configurable):
  1. Rapids (when visible)
  2. Offset shapes
  3. Path geometry
  4. Selection overlays
  5. Parts (fill areas)
  6. Chains
  7. Base shapes

#### 5. State Management (`src/lib/rendering/canvas/state/`)

- **RenderState**: Centralized rendering state

```typescript
interface RenderState {
  drawing: Drawing;
  transform: TransformState;
  selection: SelectionState;
  hover: HoverState;
  visibility: VisibilityState;
  stage: WorkflowStage;
  // ... other state
}
```

- **StateComparator**: Efficient state diffing for dirty checking
  - Deep comparison optimization
  - Change detection per renderer
  - Minimal re-render triggering

#### 6. Utilities (`src/lib/rendering/canvas/utils/`)

- **DrawingContext**: Enhanced canvas context wrapper
  - Automatic coordinate transformation
  - Style state management
  - Path building utilities

- **StyleManager**: Centralized style definitions
  - Color constants
  - Line widths
  - Selection/hover styles

## Implementation Steps

### Phase 1: Core Infrastructure ✅

- [x] Create layer management system
  - [x] Create `src/lib/rendering/canvas/layers/manager.ts`
  - [x] Create `src/lib/rendering/canvas/layers/layer.ts`
  - [x] Create `src/lib/rendering/canvas/layers/types.ts`
- [x] Implement rendering pipeline
  - [x] Create `src/lib/rendering/canvas/pipeline.ts`
  - [x] Add renderer management
  - [x] Add hit detection coordination
- [x] Create base Renderer interface
  - [x] Create `src/lib/rendering/canvas/renderers/base.ts`
  - [x] Define Renderer interface
  - [x] Create abstract base class
- [x] Set up state management
  - [x] Create `src/lib/rendering/canvas/state/render-state.ts`
  - [x] Create `src/lib/rendering/canvas/state/comparator.ts`
- [x] Create utilities
  - [x] Create `src/lib/rendering/canvas/utils/context.ts`
  - [x] Create `src/lib/rendering/canvas/utils/styles.ts`
  - [x] Create `src/lib/rendering/canvas/utils/hit-test.ts`
- [x] Run `npm run validate` and fix any errors

### Phase 2: Extract Shape Rendering ✅

- [x] Create ShapeRenderer class
  - [x] Create `src/lib/rendering/canvas/renderers/shape.ts`
  - [x] Implement render method
  - [x] Implement isDirty method
- [x] Move shape drawing functions
  - [x] Extract drawLine from DrawingCanvas
  - [x] Extract drawCircle from DrawingCanvas
  - [x] Extract drawArc from DrawingCanvas
  - [x] Extract drawPolyline from DrawingCanvas
  - [x] Extract drawEllipse from DrawingCanvas
  - [x] Extract drawSpline from DrawingCanvas
- [x] Implement shape hit detection
  - [x] Add hitTest method to ShapeRenderer
  - [x] Extract isPointNearShape logic
  - [x] Add shape-specific hit tests
- [x] Update DrawingCanvas to use ShapeRenderer
  - [x] Integrate ShapeRenderer with pipeline
  - [x] Remove old shape rendering code
  - [x] Test shape rendering still works
- [x] Run `npm run validate` and fix any errors

### Phase 3: Extract Path Rendering ✅

- [x] Create PathRenderer for green paths
  - [x] Create `src/lib/rendering/canvas/renderers/path.ts`
  - [x] Move path highlighting logic
  - [x] Add path hit detection
- [x] Create OffsetRenderer for offset visualization
  - [x] Create `src/lib/rendering/canvas/renderers/offset.ts`
  - [x] Move drawOffsetPaths logic
  - [x] Add offset shape hit detection
- [x] Create ChevronRenderer for direction arrows
  - [x] Create `src/lib/rendering/canvas/renderers/chevron.ts`
  - [x] Move drawPathChevrons logic
  - [x] Move drawChevronArrow helper
- [x] Remove path rendering from DrawingCanvas
  - [x] Delete old path rendering code
  - [x] Integrate renderers with pipeline
  - [x] Test path visualization
- [x] Create shared shape drawing module
- [x] Create `src/lib/rendering/canvas/shape-drawing.ts`
  - [x] Extract pure functions for each shape type (line, circle, arc, polyline, ellipse, spline)
  - [x] Create main `drawShape` dispatcher function
- [x] Refactor ShapeRenderer
  - [x] Replace private drawing methods with calls to shared functions
  - [x] Test that existing shape rendering still works
- [x] Fix OffsetRenderer
  - [x] Replace incomplete `drawShape` method with call to shared function
  - [x] Add debug logging to verify render calls and data
  - [x] Test offset path rendering (original dashed + offset solid)
- [x] Validate and cleanup
  - [x] Test all shape types render correctly in offsets
  - [x] Remove debug logging
  - [x] Run validation checks
- [x] Run `npm run validate` and fix any errors

### Phase 4: Extract Interactive Elements ✅

- [x] Create SelectionRenderer
  - [x] Create `src/lib/rendering/canvas/renderers/selection.ts`
  - [x] Move selection highlighting logic
  - [x] Add marquee selection support
- [x] Create HoverRenderer
  - [x] Create `src/lib/rendering/canvas/renderers/hover.ts`
  - [x] Move hover effect logic
  - [x] Add hover state management
- [x] **Complete Hit Detection in Existing Renderers**
  - [x] Extract `isPointNearShape()` from DrawingCanvas (lines 707-856) to ShapeRenderer
  - [x] Complete hit detection in OffsetRenderer using `getOffsetShapeAtPoint()` logic
  - [x] Implement hit detection in PathRenderer
  - [x] Add missing helper functions to HitTestUtils (`distance`, `distanceToLine`, `isAngleInArcRange`)
- [x] **Create Missing Renderers with Hit Detection**
  - [x] Create RapidRenderer
    - [x] Create `src/lib/rendering/canvas/renderers/rapid.ts`
    - [x] Move `drawRapids()` logic from DrawingCanvas (lines 431-467)
    - [x] Move `getRapidAtPoint()` logic from DrawingCanvas (lines 678-692)
    - [x] Add rapid hit detection with line distance calculation
  - [x] Create PartRenderer
    - [x] Create `src/lib/rendering/canvas/renderers/part.ts`
    - [x] Move part visualization logic if any
    - [x] Move `getPartAtPoint()` logic from DrawingCanvas (lines 694-705)
    - [x] Add point-in-polygon hit testing with hole exclusion
- [x] **Implement Unified Hit Detection**
  - [x] Wire up RenderingPipeline in DrawingCanvas
  - [x] Configure hit test priority order (rapids → offsets → paths → parts → chains → shapes)
  - [x] Replace `getShapeAtPoint()` calls with `pipeline.hitTest()` (lines 974, 1107)
  - [x] Replace `getOffsetShapeAtPoint()` calls with pipeline hit testing
  - [x] Replace `getRapidAtPoint()` calls with pipeline hit testing (line 950)
  - [x] Replace `getPartAtPoint()` calls with pipeline hit testing (line 1039)
  - [x] Test multi-layer hit detection priority
- [x] **Remove Hit Detection Logic from DrawingCanvas**
  - [x] Delete `getShapeAtPoint()` function (lines 626-647)
  - [x] Delete `getOffsetShapeAtPoint()` function (lines 649-676)
  - [x] Delete `getRapidAtPoint()` function (lines 678-692)
  - [x] Delete `getPartAtPoint()` function (lines 694-705)
  - [x] Delete `isPointNearShape()` function (lines 707-856)
  - [x] Delete helper functions: `distance()`, `distanceToLine()`, `isAngleInArcRange()` (lines 858-896)
  - [x] Update mouse event handlers to use unified hit testing
  - [x] Remove hit detection imports and related code
- [x] Run `npm run validate` and fix any errors

### Phase 5: Extract Specialized Renderers ✅

- [x] Create ChainRenderer
  - [x] Create `src/lib/rendering/canvas/renderers/chain.ts`
  - [x] Move chain highlighting logic
  - [x] Add chain hit detection
- [x] Create PartRenderer (completed in Phase 4)
  - [x] Create `src/lib/rendering/canvas/renderers/part.ts`
  - [x] Move part visualization logic
  - [x] Add point-in-polygon hit testing
- [x] Create RapidRenderer (completed in Phase 4)
  - [x] Create `src/lib/rendering/canvas/renderers/rapid.ts`
  - [x] Move drawRapids logic
  - [x] Add rapid hit detection
- [x] Create LeadRenderer (refactor LeadVisualization)
  - [x] Create `src/lib/rendering/canvas/renderers/lead.ts`
  - [x] Refactor LeadVisualization component
  - [x] Add lead hit detection
- [x] Create OverlayRenderer
  - [x] Create `src/lib/rendering/canvas/renderers/overlay.ts`
  - [x] Move drawOverlays logic
  - [x] Add overlay point hit detection
- [x] Remove specialized rendering from DrawingCanvas
  - [x] Delete old specialized rendering code
  - [x] Integrate all renderers
  - [x] Test all visualizations
- [x] Run `npm run validate` and fix any errors

### Phase 6: Layer Composition ✅

- [x] Implement multi-canvas layer system
  - [x] Write comprehensive tests for multi-canvas integration (`pipeline.multi-canvas.test.ts`)
  - [x] Verify LayerManager already supports multiple canvases with proper z-ordering
  - [x] Verify Layer class creates separate HTML canvas elements with CSS positioning
  - [x] Verify RenderingPipeline coordinates multi-layer rendering correctly
  - [x] Initialize RenderingPipeline with container in DrawingCanvas component
  - [x] Remove single canvas approach from DrawingCanvas
  - [x] Update event handling for multi-canvas interaction
  - [x] Add CSS styling for multi-canvas layer stacking
  - [x] Run `npm run validate` and fix any TypeScript errors
- [x] Run `npm run validate` and fix any errors

### Phase 7: Final Integration

- [ ] Set up layer stacking and compositing
  - [ ] Define layer z-order
  - [ ] Implement layer visibility control
  - [ ] Add layer blend modes if needed
  - [ ] Run `npm run validate` and fix any errors
- [ ] Implement per-layer dirty tracking
  - [ ] Add dirty flags per layer
  - [ ] Optimize partial redraws
  - [ ] Test selective rendering
  - [ ] Run `npm run validate` and fix any errors
- [ ] Optimize render scheduling
  - [ ] Implement requestAnimationFrame batching
  - [ ] Add frame rate limiting
  - [ ] Profile rendering performance
  - [ ] Run `npm run validate` and fix any errors
- [ ] Refactor DrawingCanvas to thin orchestrator
  - [ ] Remove all rendering logic
  - [ ] Keep only event handling
  - [ ] Wire up pipeline integration
- [ ] Wire up all renderers through pipeline
  - [ ] Configure renderer order
  - [ ] Set up state propagation
  - [ ] Test all interactions
- [ ] Implement efficient update batching
  - [ ] Add render queue
  - [ ] Batch state updates
  - [ ] Minimize redraws
- [ ] Add performance monitoring
  - [ ] Add FPS counter
  - [ ] Add render time tracking
  - [ ] Add layer update metrics
- [ ] Final cleanup
  - [ ] Remove all old code
  - [ ] Update component props
  - [ ] Document new architecture
- [ ] Run `npm run validate` and fix any errors
- [ ] Run full test suite
- [ ] Performance benchmark comparison

## Benefits

### Performance

- **Selective Re-rendering**: Only update changed layers
- **Reduced Overdraw**: Each element type on its own layer
- **Efficient Caching**: Per-layer render caching
- **Optimized Hit Testing**: Spatial indexing and priority-based detection

### Maintainability

- **Modular Design**: Each renderer is independent
- **Single Responsibility**: One renderer per visual element type
- **Testable Components**: Each renderer can be unit tested
- **Clear Interfaces**: Well-defined contracts between components

### Extensibility

- **Easy Feature Addition**: New renderers can be added without touching others
- **Pluggable Architecture**: Renderers can be enabled/disabled dynamically
- **Customizable Styling**: Centralized style management
- **Flexible Composition**: Layers can be reordered or conditionally shown

## File Structure

```
src/lib/rendering/canvas/
├── pipeline.ts           # Main rendering pipeline & hit detection
├── layers/
│   ├── manager.ts        # Layer management
│   ├── layer.ts          # Layer base class
│   └── types.ts          # Layer type definitions
├── renderers/
│   ├── base.ts           # Base renderer interface
│   ├── shape.ts          # Shape renderer
│   ├── chain.ts          # Chain renderer
│   ├── part.ts           # Part renderer
│   ├── path.ts           # Path renderer
│   ├── offset.ts         # Offset renderer
│   ├── lead.ts           # Lead renderer
│   ├── rapid.ts          # Rapid renderer
│   ├── chevron.ts        # Chevron renderer
│   ├── overlay.ts        # Overlay renderer
│   ├── selection.ts      # Selection renderer
│   └── hover.ts          # Hover renderer
├── state/
│   ├── render-state.ts   # Render state management
│   └── comparator.ts     # State comparison
└── utils/
    ├── context.ts        # Drawing context wrapper
    ├── styles.ts         # Style management
    └── hit-test.ts       # Hit test types & utilities
```

## Migration Strategy

1. **Incremental Migration**: Move one renderer at a time
2. **Backward Compatibility**: Keep DrawingCanvas functional during migration
3. **Testing**: Add tests for each new renderer before migration
4. **Performance Validation**: Benchmark before/after each phase
5. **Code Removal**: Remove old code immediately after successful migration

## Success Metrics

- Rendering performance improvement of 30-50%
- Reduced DrawingCanvas.svelte from ~1800 lines to <200 lines
- Unit test coverage >80% for all renderers
- Zero regressions in functionality
- Improved frame rate during pan/zoom operations
