# CAM-OCCT Development Guide

## Project Overview

CAM-OCCT is a web-based Computer-Aided Manufacturing (CAM) application that converts SVG and DXF design files into optimized G-code for CNC plasma cutting operations. The application specifically targets LinuxCNC 2.9+ QtPlasmaC controllers.

## User Workflow Stages

The application is organized around a clear 5-stage workflow that guides users from importing drawings to generating G-code:

### 1. Import Stage
**Purpose**: Import DXF or SVG drawings into the application
- Upload files via import button or drag-and-drop zone
- Configure import options (decompose polylines, translate to positive quadrant)
- Detect and display drawing units from file metadata
- Validate file format and geometry

### 2. Edit Stage  
**Purpose**: Edit the drawing using basic image editing functions
- View and manipulate drawing geometry
- Select, move, scale, and rotate shapes
- Manage layer visibility and organization
- Set display units (mm/inch) for visualization
- View shape properties and coordinates

### 3. Program Stage
**Purpose**: Build tool paths that trace the drawing using cut parameters
- Define cutting parameters (feed rates, pierce delays, lead-in/out)
- Generate optimized tool paths from geometry
- Apply cut sequencing and optimization algorithms
- Preview programmed tool paths overlaid on drawing

### 4. Simulate Stage
**Purpose**: Graphically simulate cutting process in real time
- 3D visualization of cutting simulation
- Real-time playback of tool path execution
- Time estimation and cut analysis
- Visual verification before G-code generation

### 5. Export Stage
**Purpose**: Generate G-code and export/download it
- Generate LinuxCNC-compatible G-code
- Display generated G-code for review
- Download G-code file for CNC machine
- Export cutting reports and documentation

## UI Layout Architecture

The application uses a workflow-based UI layout with three main rows: Header, Body, and Footer.

### Primary UI Hierarchy

```
window
├─ header
│  ├─ workflow stage breadcrumbs
├─ body
│  ├─ page for current workflow stage
├─ footer
│  ├─ drawing size
│  ├─ zoom factor
```

### Workflow Stage Pages

#### Import Stage
```
import
├─ Import button
├─ Drag and drop zone
├─ Decompose polylines checkbox
├─ Translate to positive quadrant checkbox
```

#### Edit Stage
```
edit
├─ left column
│  ├─ display units
│  ├─ layers
├─ center column
│  ├─ toolbar
│  ├─ drawing image
├─ right column
│  ├─ shape properties
```

#### Program Stage
```
program
├─ left column
├─ center column
│  ├─ programmed drawing image
├─ right column
```

#### Simulate Stage
```
simulate
├─ center column
│  ├─ 3D simulation viewport
├─ simulation controls
```

#### Export Stage
```
export
├─ generate gcode button
├─ generate gcode text area
├─ download button
```

### Layout Behavior

- **Header**: Always visible, shows current workflow stage via breadcrumbs
- **Body**: Content changes completely based on workflow stage
- **Footer**: Always visible, may show different information per stage
- **Navigation**: Users progress through stages sequentially (Import → Edit → Program → Simulate → Export)
- **State Management**: Each stage maintains its own state while preserving data from previous stages

## Key Technologies

- **Frontend**: Svelte 5 with TypeScript
- **Styling**: Tailwind CSS
- **3D Graphics**: Three.js
- **Geometry Processing**: OpenCascade.js
- **File Processing**: DXF parser, Web Workers
- **Build Tool**: Vite
- **Testing**: Vitest (unit tests), Playwright (e2e tests)

## Project Structure

```
cam-occt/
├── src/                   # Source code (to be created)
│   ├── lib/               # Shared libraries and utilities
│   ├── routes/            # SvelteKit routes
│   └── app.html           # Main HTML template
├── tests/                  # Test files
│   ├── dxf/               # DXF test files for testing import functionality
│   └── e2e/               # End-to-end Playwright tests (to be created)
├── reference/             # Reference implementations and third-party library docs
└── package.json           # Project dependencies and scripts
```

## Bug Fix Process

When the user reports a bug, follow this process:
1. **Write an automated test** that will catch the error
2. **Fix the bug** by implementing the necessary changes
3. **Run the test** to verify the fix works
4. **Report completion** or, if the test fails, iterate on the fix

This ensures all bugs are properly covered by tests and prevents regressions.

## Problem Solving Philosophy

**CRITICAL**: Always fix problems at the root, do not work around them.
- If there's a CSP issue blocking OpenCascade.js, fix the CSP configuration
- If there's a dependency issue, fix the dependency management
- If there's a build configuration issue, fix the build config
- Do NOT create fallback methods or workarounds that mask the real problem
- The goal is to have one consistent, working implementation, not multiple code paths

## UI Changes and Testing

**CRITICAL**: After making any changes to the UI (layout, components, styling, text content), you MUST:
1. **Run Svelte/Vite build check** with `npm run build` to ensure no compilation errors
2. **Run unit tests** with `npm run test` to catch any TypeScript or logic errors
3. **Rerun all e2e Playwright tests** to ensure they still pass
4. **Fix any failing tests** caused by UI changes (selectors, text expectations, layout changes)
5. **Update test expectations** if the UI changes are intentional
6. **Verify screenshot tests** still capture the correct visual elements

**NEVER tell the user you are done without running these tests first.** UI changes frequently break e2e tests due to changed selectors, moved elements, or different text content. Build errors are common when adding new components or imports.

## Development Guidelines

### 1. Code Organization

- **Components**: Create reusable Svelte components in `src/components/`
- **Code**: Place application code in `src/lib/`
- **Types**: TypeScript type definitions in `src/types/`
- **Pages**: Svelte pages go in `src/routes/`
- **Styles**: CSS styles go in `src/styles/`

### 2. Testing Strategy

#### Unit Tests
- Place unit tests alongside the files they test (e.g., `utils.ts` → `utils.test.ts`)
- Use Vitest for unit testing
- Focus on testing core algorithms, utility functions, and data transformations
- Run with: `npm run test`

#### E2E Tests
- Place all e2e tests in `tests/e2e/`
- Use Playwright for browser automation
- Test complete user workflows (file import → optimization → export)
- Run with: `npm run test:e2e`
- Interactive UI: `npm run test:e2e:ui`

#### Test Data
- Use DXF files from `tests/dxf/` for import testing

### 3. Available Scripts

```bash
npm run dev          # Start development server (already running in manual testing)
npm run build        # Build for production
npm run preview      # Preview production build
npm run check        # Svelte type checking
npm run typecheck    # TypeScript type checking
npm run validate     # Run all validation checks
npm run test         # Run unit tests
npm run test:e2e     # Run e2e tests
```

### 4. Core Features to Implement

Based on the PRD, the following features need implementation:

#### Phase 1 (MVP)
1. **File Import System**
   - SVG parser and processor
   - DXF parser integration (using existing `dxf` package)
   - File validation and error handling

2. **Basic Drawing Editor**
   - Shape selection and deletion
   - Object repositioning (drag & drop)
   - Scaling and rotation tools
   - Undo/redo functionality

### DXF Parser Implementation Details

#### Supported Entity Types
The DXF parser currently supports the following entity types:
- **LINE**: Direct line entities and lines from LINE entity arrays
- **CIRCLE**: Circular entities 
- **ARC**: Arc entities with proper angle handling
- **SPLINE**: NURBS curves converted to polylines using control point sampling
- **LWPOLYLINE/POLYLINE**: Lightweight and regular polylines with bulge support
- **INSERT**: Block references with full transformation support

#### INSERT Entity (Block Reference) Support
**Status**: ✅ COMPLETED & VERIFIED

INSERT entities allow DXF files to reference reusable block definitions with transformations:

**Transformation Support:**
- **Translation**: X, Y insertion point coordinates
- **Scaling**: Separate X and Y scale factors
- **Rotation**: Rotation angle in degrees (converted to radians)
- **Defaults**: Graceful handling with sensible fallbacks (0 for translation/rotation, 1 for scaling)

**Implementation Details:**
- Blocks are indexed by name in a Map structure during parsing
- Block base points are stored and used for correct INSERT positioning
- Each INSERT entity references a block by name and applies transformations
- INSERT positions are offset by the block's base point for correct DXF compliance
- Transformations are applied in correct order (matching reference implementation):
  1. Translate by negative block base point
  2. Apply scaling (scaleX, scaleY)
  3. Apply rotation (in radians)
  4. Translate to INSERT position (x, y)
- All geometry types (line, circle, arc, polyline) support transformation
- Nested block support through recursive entity processing

**Block Base Point Handling:**
- DXF blocks have a base point that defines the origin for INSERT operations
- INSERT coordinates are relative to this base point
- The parser correctly applies transformation matrix: translate(-basePoint) → scale → rotate → translate(insertPos)
- This ensures INSERT entities appear in the correct absolute positions per DXF standard

**Bug Fix Completed:**
- Fixed transformation order to match reference implementation in `./reference/dxf-viewer`
- Corrected block base point handling for proper INSERT positioning
- Resolved user-reported issue where Blocktest.dxf showed wrong positioning

**Testing:**
- ✅ Comprehensive test suite covers transformation accuracy and positioning
- ✅ Real DXF file testing with Blocktest.dxf shows correct layout: 6-8 distinct squares
- ✅ Verification of complex transformations including rotation, scaling, and translation
- ✅ Base point offset testing ensures INSERT entities appear in correct positions
- ✅ All 48 line entities correctly parsed and transformed (6 direct + 7 INSERT × 6 lines each)

3. **Cut programming**
   - Basic cutting parameters
   - Apply cutting parameters to shapes to create tool paths

4. **Cut Path Generation**
   - Basic path optimization (minimize rapid movements)
   - Cut sequencing

5. **G-code Export**
   - LinuxCNC compatible output

#### Phase 2 (Optimization)
1. **Advanced Optimization**
   - Lead-in/lead-out generation
   - Overcutting
   - kerf compensation: Insetting and outsetting of cuts
   - Nesting algorithms
   - Hole detection and underspeed setting
   - Material database

2. **Visualization**
   - 3D cut simulation using Three.js
   - Real-time preview
   - Time estimation

### 5. Architecture Patterns

#### State Management
- Use Svelte stores for global application state
- Keep component state local when possible
- Consider using a state machine for complex workflows

#### File Processing
- Use Web Workers for heavy computational tasks
- Implement progressive loading for large files
- Add proper error boundaries and fallbacks

#### Performance Considerations
- Lazy load heavy dependencies (OpenCascade.js, Three.js)
- Use virtual rendering for large datasets
- Implement debouncing for real-time operations

### 6. OpenCascade.js Integration

**IMPORTANT**: Always prefer OpenCascade.js built-in geometry functions when possible. This ensures precision, performance, and consistency with CAD standards.

OpenCascade.js is used for ALL geometry operations:
- **Bounding box calculations** - Use `Bnd_Box` and `BRepBndLib::Add()`
- **Boolean operations** - Union, difference, intersection using `BRepAlgoAPI_*`
- **Offset calculations** - For kerf compensation using `BRepOffsetAPI_MakeOffset`
- **Complex curve handling** - Splines, NURBS, arcs using `Geom_*` classes
- **Geometric validation** - Shape analysis and repair
- **Distance calculations** - Point-to-curve, curve-to-curve distances
- **Area and volume calculations** - Using `GProp_GProps` and `BRepGProp::*`

When implementing any geometry-related functionality, first check if OpenCascade.js provides a built-in solution before writing custom algorithms.

### 7. Three.js Usage

Three.js handles all 3D visualization:
- 2D/3D viewport rendering
- Cut path animation
- Interactive camera controls
- Selection and highlighting

### 8. G-code Generation

When generating G-code for LinuxCNC QtPlasmaC:
- Use appropriate M-codes for plasma control
- Include torch height control (THC) commands
- Add proper pierce delays
- Control ohmic sensing on/off state

### 9. Error Handling

- Validate all file imports with clear error messages
- Handle geometry errors gracefully
- Provide fallback options for optimization failures
- Log errors appropriately for debugging

### 10. Browser Compatibility & Rendering

**Client-Side Only Application**: This application is designed to run entirely in the browser and does NOT support Server-Side Rendering (SSR). All processing happens on the client side for optimal performance with large files and complex calculations.

Target modern browsers only:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Use feature detection for:
- Web Workers
- WebGL (for Three.js)
- File API
- Drag & Drop API

**Note**: The application uses dynamic imports for heavy dependencies to ensure optimal loading performance.

**IMPORTANT**: Never run the dev server (`npm run dev`) as it is assumed to always be running at the default port during development. Only reference the running server for testing purposes.

**CRITICAL**: DO NOT EVER START THE DEV SERVER WITH `npm run dev`. The user manages the dev server themselves. If you need the dev server running, ask the user to start it. Never run `npm run dev` under any circumstances, even if it appears to not be running.

## Common Development Tasks

### Adding a New File Parser
1. Create parser in `src/lib/parsers/`
2. Add unit tests for parser logic
3. Integrate with file import system
4. Add e2e test for complete workflow

### Creating a New Tool
1. Define tool component in `src/lib/components/tools/`
2. Add tool state management
3. Implement tool interactions
4. Create keyboard shortcuts
5. Add to toolbar UI

### Implementing an Optimization Algorithm
1. Create algorithm in `src/lib/optimization/`
2. Add comprehensive unit tests
3. Benchmark performance with test files
4. Add UI controls and feedback
5. Document algorithm behavior

## Performance Guidelines

- Keep initial bundle size under 500KB
- Lazy load heavy dependencies
- Use Web Workers for computations > 16ms
- Implement virtual scrolling for large lists
- Cache computed values appropriately

## Security Considerations

- Validate all file inputs
- Sanitize SVG content before rendering
- Use Content Security Policy headers
- Never execute user-provided code
- Validate G-code output before export

## Debugging Tips

- Use browser DevTools Performance tab for profiling
- Enable Svelte DevTools for component inspection
- Use `npm run check:watch` during development
- Test with various DXF files from `test/dxf/`
- Check console for OpenCascade.js initialization

## Third-Party Documentation

Documentation for key libraries is available in `.claude/docs/` (when present):
- OpenCascade.js API reference
- Three.js examples and guides
- DXF format specifications
- LinuxCNC G-code reference

## Contributing Guidelines

1. **Before Starting**: Review the PRD.md for feature requirements
2. **Code Style**: Follow existing patterns in the codebase
3. **Testing**: Write tests for new functionality
4. **Type Safety**: Ensure TypeScript strict mode compliance
5. **Performance**: Profile and optimize critical paths
6. **Documentation**: Update relevant documentation

## Quick Start for New Features

1. Understand the requirement from PRD.md
2. Plan implementation with appropriate data structures
3. Write failing tests first (TDD approach)
4. Implement feature incrementally
5. Ensure all tests pass
6. Run validation: `npm run validate`
7. Test manually with sample files
8. Create e2e test for user workflow

## Shape Origins and Geometry

**Shape Origins**: Every shape has a geometric origin that defines its position on the x,y plane:
- **Circle**: The origin is the center point
- **Line**: The origin is the start point
- **Arc**: The origin is the center point
- **Polyline**: The origin is the first point in the sequence
- **Spline** (converted to polyline): The origin is the first sampled point

Understanding shape origins is critical for:
- Shape positioning and transformations
- Calculating relative distances between shapes
- Tool path generation and sequencing
- UI display of shape properties

## Shape Selection and Interaction Rules

**CRITICAL**: All shape types must follow consistent hover and selection rules in the canvas:

- **Selection**: Every shape type (line, circle, arc, polyline, spline) must be selectable by clicking
- **Hit Detection**: All shapes must implement proper hit detection in `isPointNearShape()` function
- **Common Bug**: Missing cases in the switch statement for new shape types (e.g., arc was missing)
- **Tolerance**: Use consistent tolerance values scaled by zoom level for fair selection across shapes
- **Visual Feedback**: Selected shapes should use consistent highlight styling

When adding new shape types:
1. Add rendering case in `drawShape()` function
2. Add hit detection case in `isPointNearShape()` function  
3. Add bounds calculation in `getShapePoints()` function
4. Test selection behavior manually

## Shape Color Scheme and Visual Behavior

**CRITICAL**: The application uses a consistent color scheme for shape states:

### Color Requirements:
- **Normal shapes**: Black (`#000000`) with 1px line width
- **Hovered shapes**: Orange (`#ff6600`) with 1.5px line width  
- **Selected shapes**: Orange (`#ff6600`) with 2px line width
- **Origin cross**: Gray (`#888888`) with 1px line width

### Visual Behavior Rules:
- **Priority**: Selected state overrides hovered state overrides normal state
- **Consistency**: ALL shape types (line, circle, arc, polyline, spline) must use the same colors
- **Context Management**: Use `ctx.save()` and `ctx.restore()` to prevent color bleeding between shapes
- **Hover Detection**: Mouse movement updates hover state in real-time when not dragging
- **Properties Display**: Hover shows shape properties with blue text "Showing hovered shape (click to select)"

### Implementation Notes:
- Shape drawing must save/restore canvas context to prevent style interference
- Origin cross drawing can affect subsequent shape colors if context isn't managed properly
- Each `drawShape()` call should be isolated with its own context state

## DXF Polyline Bulge Handling

**CRITICAL**: DXF polylines and lwpolylines can contain bulge factors that define curved segments between vertices. Proper bulge handling is essential for accurate CAD file rendering.

### Bulge Factor Mathematics

**Formula**: `bulge = tan(θ/4)` where θ is the included angle of the arc segment

**Sign Convention**:
- **Positive bulge**: Counter-clockwise arc direction (left turn)
- **Negative bulge**: Clockwise arc direction (right turn)
- **Zero bulge**: Straight line segment
- **Special case**: `bulge = ±1.0` creates a perfect semicircle (180°)

### Bulge-to-Arc Conversion Algorithm

```typescript
const theta = 4 * Math.atan(bulge); // Include sign for direction
const radius = Math.abs(chordLength / (2 * Math.sin(theta / 2)));
const perpDist = radius * Math.cos(theta / 2);
const perpAngle = Math.atan2(dy, dx) + (bulge > 0 ? Math.PI / 2 : -Math.PI / 2);

const center = {
  x: chordMidX + perpDist * Math.cos(perpAngle),
  y: chordMidY + perpDist * Math.sin(perpAngle)
};
```

### Implementation Requirements

1. **Parser Level**: Preserve bulge data in polyline vertices when decomposition is disabled
2. **Rendering Level**: Canvas must handle bulges when drawing polylines
3. **Decomposition Level**: Convert bulged segments to proper arc entities
4. **Type System**: Support `PolylineVertex` interface with optional bulge property

### Two Rendering Modes

1. **Bulge-Preserved Mode** (`decomposePolylines: false`):
   - Returns polylines with bulge data intact
   - Canvas renders curved segments using bulge-to-arc conversion
   - Maintains original polyline structure for editing

2. **Decomposed Mode** (`decomposePolylines: true`):
   - Breaks polylines into individual line and arc entities
   - Better for CAM processing requiring separate geometric elements
   - Each curved segment becomes an independent arc shape

### Testing Requirements

- Test with files containing various bulge magnitudes (±0.1 to ±2.0)
- Verify both CW and CCW arc directions
- Ensure semicircle cases (bulge = ±1.0) render correctly
- Compare visual output between bulge-preserved and decomposed modes

### Common Files with Bulges

- `Polylinie.dxf`: 16 vertices with 10 non-zero bulges, complex mixed geometry
- `polylines_with_bulge.dxf`: Simple test case with basic bulge scenarios
- `AFluegel Rippen b2 0201.dxf`: Real-world example with intricate curved profiles

## Common Pitfalls to Avoid

- Don't assume file formats are standard - always validate
- Avoid blocking the main thread with heavy computations
- Don't trust user input - validate and sanitize
- Remember browser memory limits with large files
- Test with real-world DXF files, not just simple shapes
- Consider touch device support from the start
- Always use context save/restore when drawing shapes to prevent color bleeding
- **Never ignore bulge factors** - they define essential curved geometry in polylines
- **Test both rendering modes** - bulge-preserved and decomposed should both work correctly

## Core Algorithms

### DXF Polyline Decomposition Algorithm

**Purpose**: Convert DXF polyline entities into individual line and arc shapes for precise CAM processing.

**Algorithm Process**:
1. Iterate through consecutive vertex pairs in the polyline
2. Check each vertex's bulge factor to determine segment type
3. For zero bulge: create straight line segment between vertices
4. For non-zero bulge: convert to arc using bulge-to-arc mathematics
5. Handle closing segment for closed polylines (last vertex to first)
6. Return array of individual Shape objects

**Key Features**:
- Preserves exact geometry by converting bulge factors to precise arc parameters
- Handles both open and closed polylines
- Creates independent shapes suitable for CAM tool path generation
- Maintains original layer and styling information

**Use Cases**:
- When individual geometric elements are needed for machining operations
- For applications requiring separate selection/manipulation of polyline segments
- When exporting to formats that don't support complex polylines

### Drawing Translation to Positive Quadrant Algorithm

**Purpose**: Automatically translate imported drawings so their bounding box starts at the origin (0,0), ensuring all geometry is in the positive quadrant.

**Algorithm Process**:
1. Calculate drawing's current bounding box from all shapes
2. Determine translation vector needed to move minimum point to origin
3. Skip translation if drawing is already in positive quadrant
4. Apply translation to all shape types (lines, circles, arcs, polylines)
5. For polylines, translate both points and vertices arrays while preserving bulge data
6. Update drawing bounds to reflect new position

**Key Features**:
- Only translates when necessary (negative coordinates exist)
- Preserves all relative positions and geometric relationships
- Handles all shape types including bulge-aware polylines
- Updates drawing bounds to reflect new position
- Compatible with polyline decomposition and other import options

**Benefits**:
- Ensures consistent coordinate system for CAM operations
- Eliminates negative coordinate issues in G-code generation
- Simplifies material positioning and nesting algorithms
- Provides predictable origin point for machining setup

**Algorithm Complexity**: O(n) where n is the number of shapes, as each shape is processed exactly once for both bounds calculation and translation.

### Shape Chain Detection Algorithm

**Purpose**: Detect connected sequences of shapes where endpoints overlap within a user-defined tolerance for optimized cutting path generation.

**Algorithm Definition**: 
A chain is defined as a connected sequence of shapes where some point in shape A overlaps with some point in shape B within the specified tolerance distance. The overlap relationship is transitive - if A connects to B and B connects to C, then A, B, and C form a single chain.

**Core Algorithm Process**:
1. **Point Extraction**: Extract key geometric points from each shape:
   - **Lines**: Start and end points
   - **Circles**: Center plus 4 cardinal points (right, left, top, bottom)
   - **Arcs**: Start point, end point, and center
   - **Polylines**: All vertices in the point sequence

2. **Connectivity Analysis**: For each pair of shapes, check if any point from shape A is within tolerance distance of any point from shape B using Euclidean distance formula

3. **Union-Find Processing**: Use Union-Find (Disjoint Set) data structure to efficiently group connected shapes into chains:
   - Initialize each shape as its own component
   - Union shapes that are within tolerance distance
   - Apply path compression and union by rank for optimal performance

4. **Chain Formation**: Group shapes by their root component and create chain objects for groups containing multiple shapes

**Key Features**:
- **User-Configurable Tolerance**: Default 0.05 units, adjustable from 0.001 to 10 units
- **Mixed Shape Support**: Works with lines, circles, arcs, and polylines
- **Transitive Connectivity**: A→B→C connections form single chains
- **Efficient Performance**: O(n²α(n)) complexity where α is inverse Ackermann function
- **Visual Feedback**: Detected chains are colored blue in the canvas

**Implementation Details**:
- **Location**: `src/lib/algorithms/chain-detection.ts`
- **Store Integration**: Chain data managed via `chainStore` for reactive UI updates
- **Canvas Integration**: Shapes in chains rendered with blue stroke color (#2563eb)
- **UI Controls**: Tolerance input and "Detect Chains" button in Program stage

**Chain Detection Options**:
```typescript
interface ChainDetectionOptions {
  tolerance: number; // Distance tolerance for point overlap (default: 0.05)
}
```

**Testing Coverage**:
- Basic connectivity detection with various tolerances
- Mixed shape type chaining (lines, circles, arcs, polylines)
- Complex scenarios: branching chains, closed loops, large chain sequences
- Edge cases: empty arrays, single shapes, zero tolerance, identical points
- Performance validation with large shape sets

**Use Cases**:
- **Tool Path Optimization**: Identify connected geometry for continuous cutting paths
- **Pierce Point Reduction**: Minimize torch starts by following connected chains
- **Cut Sequencing**: Group related shapes for efficient machining order
- **Quality Control**: Verify drawing connectivity before G-code generation

**Visual Integration**:
- Chain shapes displayed with blue stroke color in Program stage canvas
- Chain detection results shown in right panel with shape counts
- Real-time tolerance adjustment with immediate re-detection capability
- Integration with existing selection and hover states (priority: selected > hovered > chain > normal)

**Algorithm Complexity**: O(n²α(n)) where n is the number of shapes and α is the inverse Ackermann function (effectively constant for practical input sizes).

## Display Units and Physical Scaling

**CRITICAL**: The application implements proper unit handling to ensure accurate physical representation of CAD drawings on screen.

### Unit System Architecture

**Display Units vs Drawing Units**:
- **Drawing Units**: The original units detected from the DXF file (stored in drawing.units)
- **Display Units**: The units selected by the user for visualization (stored in displayUnit)
- **Physical Scaling**: Automatic scaling to show correct physical size on screen

### Unit Detection from DXF Files

The application extracts units from the DXF `$INSUNITS` header variable:
- **Value 1**: Inches → 'inch'
- **Value 4**: Millimeters → 'mm' 
- **Value 5**: Centimeters → treated as 'mm'
- **Value 6**: Meters → treated as 'mm'
- **Default**: 'mm' for all other values (unitless, feet, etc.)

When a DXF file is loaded:
1. Units are extracted from the header
2. The display unit dropdown defaults to the detected unit
3. The view is reset to 100% zoom (scale = 1)
4. Drawing is centered at origin

### Physical Size Display

**Core Principle**: At 100% zoom, geometry values are displayed at the physical size specified by the display unit setting. When display units change, the visual scale changes accordingly.

**Implementation**:
- Display unit controls physical interpretation: 100 units → 100mm when display=mm, 100" when display=inch
- 1 mm display = ~3.78 pixels on screen (96 DPI standard)
- 1 inch display = 96 pixels on screen
- Physical scale depends on the DISPLAY unit selection, not geometry units
- Zoom factor remains independent of unit changes

**Scaling Formula**:
```typescript
const physicalScale = getPhysicalScaleFactor(drawing.units, displayUnit); // Display unit controls scale
const totalScale = zoomScale * physicalScale;
```

### Unit Switching Behavior

When user changes display units:
- **Visual size changes** - geometry values are interpreted as the selected display unit
- **Geometry coordinates remain unchanged** (no data modification)
- **Zoom level stays the same** (scale factor unchanged)
- **Physical interpretation changes** - same numeric values shown at different physical sizes

**CRITICAL**: Display unit switching SHOULD change visual scale. A 186.2 unit drawing should appear 186.2mm wide when display=mm, and 186.2 inches wide when display=inch at 100% zoom.

### Canvas Coordinate System

All canvas transformations use `totalScale` which combines:
- **User zoom scale**: Controlled by mouse wheel (1.0 = 100%)
- **Physical scale**: Unit-based scaling for correct physical size
- **Y-axis flip**: CAD convention (positive Y up) vs canvas (positive Y down)

### Implementation Guidelines

1. **Always use totalScale** for canvas rendering, hit testing, and coordinate transformations
2. **Physical scale depends on display units** - always pass both geometry and display units to getPhysicalScaleFactor()
3. **Reset to 100% zoom** when loading new drawings for consistency
4. **Update all visual elements** (line widths, point sizes, tolerances) using totalScale
5. **Maintain geometry precision** - never modify coordinate data during unit switches
6. **Test physical accuracy** - use a ruler to verify screen measurements match expected physical size for the display unit

### Testing Requirements

- Test unit detection from various DXF files with different $INSUNITS values
- **Verify physical size accuracy** using physical rulers on screen at 100% zoom for both display unit settings
- **Test that unit switching DOES change visual size** - geometry values are interpreted as display units physically
- Test coordinate accuracy after unit switches (shapes should remain selectable)
- Verify proper scaling of UI elements (line widths, selection points, etc.)
- **Physical size test**: ADLER.DXF (186.2 units) should measure 186.2mm when display=mm, 186.2 inches when display=inch at 100% zoom