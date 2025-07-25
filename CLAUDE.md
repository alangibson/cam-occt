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

## Key Technical Context

### Tractor Seat Mount Test File
The "Tractor Seat Mount - Left.dxf" test file should produce 1 part with 12 holes:
- 4 round holes (circles)
- 8 holes formed by spline curves that create letter shapes
- "Hole" in the context of part detection does not imply roundness - it refers to any closed chain that is contained within a part's outer boundary

### Chain Closure Tolerance
**CRITICAL**: Use ONLY the user-set tolerance from the Program page for ALL chain closure detection. Do NOT implement "adaptive tolerance" or any other tolerance calculation based on chain size, complexity, or other factors. The user-set tolerance is the single source of truth for determining if chains are closed.

- Chain closure detection must use exactly the tolerance value set by the user
- Part detection must pass the user tolerance to all chain closure functions  
- UI chain status display must use the same user tolerance
- Any "adaptive" or "smart" tolerance calculations are explicitly forbidden

### Chain Normalization and Closure
**IMPORTANT**: When analyzing chain traversal, coincident points between the first shape (shape 1) and the last shape (final shape) are EXPECTED and CORRECT for closed chains. This is what makes a chain closed - the end point of the last shape should coincide with the start point of the first shape.

- Do NOT report this as an error or warning - this is normal closed chain behavior
- Only report non-sequent shape coincident points as potential ordering issues when they occur between shapes that are not first/last
- Chain normalization should preserve this first/last coincidence for proper closure

## Key Technologies

- **Frontend**: Svelte 5 with TypeScript
- **Styling**: Tailwind CSS
- **3D Graphics**: Three.js
- **Geometry Processing**: Custom algorithms
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
- Lazy load heavy dependencies (Three.js)
- Use virtual rendering for large datasets
- Implement debouncing for real-time operations

### 6. Geometric Algorithms

**CRITICAL**: Use well-tested, mathematically sound geometric algorithms. Focus on accuracy and robustness when implementing custom geometric operations.

Custom geometric algorithms are used for ALL geometry operations:
- **Bounding box calculations** - Calculate min/max coordinates from shape geometry
- **Boolean operations** - Custom intersection, union, and difference algorithms
- **Containment detection** - Point-in-polygon tests using ray casting or winding number
- **Offset calculations** - For kerf compensation using custom offsetting algorithms
- **Complex curve handling** - Splines, NURBS, arcs using mathematical curve definitions
- **Geometric validation** - Shape analysis and repair using custom validation
- **Distance calculations** - Point-to-curve, curve-to-curve distance algorithms
- **Area and volume calculations** - Using geometric integration methods
- **Point-in-polygon tests** - Ray casting algorithm for containment detection

**Testing Geometric Algorithms**:
Always unit test geometric operations thoroughly:

1. **Edge Cases**: Test with degenerate geometries, zero-area shapes, and boundary conditions
2. **Accuracy**: Verify numerical precision with known geometric properties
3. **Performance**: Benchmark with large datasets and complex geometries
4. **Robustness**: Test with real-world CAD file data

When implementing geometric functionality, prioritize mathematical correctness and numerical stability.

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
- Monitor console for geometric algorithm performance

## Third-Party Documentation

Documentation for key libraries is available in `.claude/docs/` (when present):
- Three.js examples and guides
- DXF format specifications
- LinuxCNC G-code reference
- Geometric algorithm references

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

### Chain Traversal and Normalization Concepts

**Terminology**:
- **Sequent shapes**: Shapes that are next to each other in the chain sequence (e.g., shape[i] and shape[i+1])
- **Adjacent shapes**: Shapes that are geometrically touching/connected (may not be sequent)
- Use "sequent" when referring to chain ordering, "adjacent" for geometric relationships

**Chain Closure Detection**:
- **Closed chain**: The end point of the last shape is coincident with the start point of the first shape (within tolerance)
- **Open chain**: The end point of the last shape is NOT coincident with the start point of the first shape
- **Special case**: If the sequent shapes are the first and last shapes in the chain and their endpoints are coincident, consider the chain closed
- This is a fundamental concept for toolpath generation - closed chains represent complete boundaries, open chains represent partial paths

**Chain Normalization**:
- Reorders and reverses shapes to achieve proper end-to-start traversal
- For arcs: When reversing, flip the `clockwise` flag to maintain sweep direction
- For polylines with bulges: When reversing, negate all bulge values and shift associations to preserve arc directions

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

---

### Part Detection Algorithm

**Purpose**: Analyze chains to detect hierarchical part structures consisting of shells (outer boundaries) and holes, enabling proper cutting sequence optimization and tool path generation.

**Algorithm Definition**: 
A part consists of a shell (closed chain forming the outer boundary of a part) and zero or more holes (closed chains contained within the shell). The algorithm supports recursive nesting where parts can exist within holes of larger parts, creating a hierarchical structure.

**Part Structure Hierarchy**:
- **Part Shell**: Closed chain at even nesting levels (0, 2, 4...) - represents the outer boundary of a part
- **Part Hole**: Closed chain at odd nesting levels (1, 3, 5...) - represents voids within a part
- **Recursive Nesting**: Parts within holes within parts, supporting unlimited depth

**Core Algorithm Process**:

1. **Chain Classification**: Separate chains into closed and open categories:
   - **Closed Chains**: Chains where the end point of the last shape connects to the start point of the first shape within tolerance (0.01 units)
   - **Open Chains**: All other chains that don't form closed loops

2. **Bounding Box Calculation**: Calculate accurate bounding boxes for all closed chains:
   - **Lines**: Min/max of start and end coordinates
   - **Circles**: Center ± radius for all axes
   - **Arcs**: Conservative bounding box using center ± radius (simplified)
   - **Polylines**: Min/max of all vertex coordinates

3. **Containment Hierarchy Analysis**: Build parent-child relationships between closed chains:
   - For each chain, find the smallest chain that completely contains it
   - Use bounding box containment tests with strict inequality to avoid self-containment
   - Create containment map (child → parent) for hierarchy traversal

4. **Nesting Level Calculation**: Determine the depth of each chain in the hierarchy:
   - **Level 0**: Root chains (not contained by any other chain)
   - **Level N**: Chains contained by a chain at level N-1
   - Walk up the containment hierarchy to calculate depth

5. **Shell Identification**: Classify chains as shells or holes based on nesting level:
   - **Even Levels (0, 2, 4...)**: Part shells (outer boundaries)
   - **Odd Levels (1, 3, 5...)**: Part holes (voids within parts)

6. **Part Structure Building**: Create hierarchical part objects:
   - For each shell, find all direct child holes (level N+1)
   - Recursively build hole structures with nested parts
   - Generate unique IDs for parts, shells, and holes

7. **Warning Generation**: Detect problematic open chains:
   - Check if open chain endpoints cross closed chain boundaries
   - Generate warnings for chains that may interfere with part boundaries

**Key Features**:
- **Hierarchical Nesting**: Unlimited depth part-within-hole-within-part structures
- **Automatic Shell/Hole Classification**: Even/odd level determination
- **Boundary Crossing Detection**: Warnings for open chains that cross part boundaries
- **Mixed Shape Support**: Works with rectangles, circles, and complex polygons
- **Visual Differentiation**: Shells colored blue (#2563eb), holes colored light blue (#93c5fd)

**Implementation Details**:
- **Location**: `src/lib/algorithms/part-detection.ts`
- **Store Integration**: Part data managed via `partStore` for reactive UI updates
- **Canvas Integration**: Different colors for shells and holes in Program stage
- **UI Integration**: "Detect Parts" button in toolbar, Parts list in left panel, warnings in right panel

**Data Types**:
```typescript
interface DetectedPart {
  id: string;
  shell: PartShell;
  holes: PartHole[];
}

interface PartShell {
  id: string;
  chain: ShapeChain;
  type: 'shell';
  boundingBox: BoundingBox;
  holes: PartHole[];
}

interface PartHole {
  id: string;
  chain: ShapeChain;
  type: 'hole';
  boundingBox: BoundingBox;
  holes: PartHole[]; // Nested holes (parts within this hole)
}
```

**Warning System**:
```typescript
interface PartDetectionWarning {
  type: 'overlapping_boundary';
  chainId: string;
  message: string;
}
```

**Algorithm Complexity**:
- **Time Complexity**: O(n²) for containment analysis + O(n) for hierarchy building = O(n²)
- **Space Complexity**: O(n) for containment map and part structures

**Testing Coverage**:
- Basic part detection with single shells and holes
- Multi-level hierarchical nesting (parts within holes within parts)
- Complex nesting scenarios with multiple branches
- Warning generation for boundary-crossing open chains
- Edge cases: identical bounding boxes, very small chains, negative coordinates
- Chain closure detection with tolerance handling
- Mixed shape types (rectangles, circles, complex polygons)

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

## Part Detection Algorithm

### Critical Design Principles

**USE PROPER GEOMETRIC CONTAINMENT FOR PART DETECTION**

Proper geometric containment is essential for determining part/hole relationships:

1. **Point-in-polygon tests**: Use ray casting or winding number algorithms for accurate containment
2. **Curve intersection analysis**: Detect when boundaries cross or overlap
3. **Area-based validation**: Verify containment using geometric area calculations
4. **Numerical precision**: Handle floating-point errors with appropriate tolerances
5. **Mathematical correctness**: Ensure algorithms follow established geometric principles

**Bounding box checks can be used as a fast preliminary filter** but must always be followed by proper geometric containment verification.

### Fallback and Simplification Approval Requirement

**CRITICAL**: All fallbacks, workarounds, and geometric simplifications in algorithms must be explicitly approved by the user before implementation. This includes but is not limited to:

- Bounding box containment as fallback for geometric operations
- Adaptive tolerance calculations instead of user-set tolerances  
- Polyline-to-edge oversimplifications that lose geometric detail
- Any approximation methods that could affect geometric accuracy
- Fallback algorithms when primary geometric operations fail

The user must review and approve each proposed fallback or simplification to ensure it meets the application's accuracy requirements. Document all approved fallbacks with clear explanations of when and why they are used.

### Correct Approach: Custom Geometric Algorithms

Use custom geometric algorithms for mathematically sound containment:

```typescript
// CORRECT: Point-in-polygon containment test
function isChainContained(innerChain: ShapeChain, outerChain: ShapeChain): boolean {
  // Test if all points of inner chain are inside outer chain polygon
  const innerPoints = extractChainPoints(innerChain);
  return innerPoints.every(point => isPointInPolygon(point, outerChain));
}

// Ray casting algorithm for point-in-polygon test
function isPointInPolygon(point: Point, chain: ShapeChain): boolean {
  // Implementation using ray casting algorithm
  // Returns true if point is inside the polygon formed by the chain
}
```

### Testing Requirements

- **Unit tests for geometric algorithms**: Test mathematical correctness and edge cases
- **Numerical precision validation**: Verify algorithms handle floating-point precision correctly
- **Verify with complex geometries**: Test overlapping, nested, and edge cases

### Historical Issues

Key requirements for geometric containment:
- Point-in-polygon tests for accurate containment detection
- Proper handling of edge cases and numerical precision
- Mathematical validation of containment relationships

Incorrect approaches to avoid:
- Bounding box-only containment (insufficient for complex shapes)
- Size-based assumptions without geometric verification
- Area ratios without proper containment validation

## DXF Test Files and Expected Part Detection Results

The following DXF files in `tests/dxf/` are used for testing part detection algorithms. Each file has specific expectations:

| File | Expected Parts | Expected Holes | Current Status | Notes |
|------|----------------|----------------|----------------|-------|
| `1.dxf` | 2 parts | 0 holes | ❌ Detects 1 part | Simple geometry that should separate into 2 parts |
| `2.dxf` | 2 parts | 0 holes | ✅ Correctly detects 2 parts | Working correctly |
| `3.dxf` | 2 parts | 0 holes | ❌ Detects 1 part | Geometry issue preventing proper separation |
| `1997.dxf` | 4 parts | 2 holes total | ✅ Correctly detects 4 parts with 2 holes | Chain-2 contains chain-3, chain-4 contains chain-5 |
| `ADLER.dxf` | 9 parts | 1 hole total | ✅ Correctly detects 9 parts with 1 hole | Chain-5 contains chain-10 as hole |
| `Tractor Seat Mount - Left.dxf` | 1 part | Multiple holes | ❌ Detects 4 parts | **Multi-layer file** - layers need to be squashed before detection |
| `2013-11-08_test.dxf` | 1 part | 3 holes | ❌ Detects 3 parts | **Multi-layer file** - layers need to be squashed before detection |
| `probleme.dxf` | 0 parts (warning) | 0 holes | ❌ No warning issued | Unclosed chains prevent part detection - should warn user |

### Multi-Layer DXF Files

Some DXF files contain multiple layers where one layer represents the part outline and another represents holes. For proper part detection:

1. **Layer Squashing Required**: All layers must be combined into a single geometry set before part detection
2. **Hole Layers**: Typically contain circular or complex hole patterns
3. **Part Layers**: Contain the main part outline
4. **Processing Order**: Squash layers → detect chains → detect parts/holes

### Problematic Files Requiring Special Handling

**`probleme.dxf`**: This file contains unclosed chains where arc endpoints don't exactly connect to adjacent geometry. When no parts are detected due to unclosed chains, the system should:
- Issue a warning to the user about potential geometry problems
- Suggest checking for gaps in the drawing
- Recommend tolerance adjustment or manual geometry repair

### Testing Approach

Tests verify:
1. **Correct part/hole counts** for each file
2. **Proper geometric containment** using custom geometric algorithms
3. **Warning generation** for problematic files
4. **Layer handling** for multi-layer files (when implemented)
5. **Chain closure detection** with appropriate tolerances