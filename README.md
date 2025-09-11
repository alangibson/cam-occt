# MetalHead CAM

MetalHead CAM is a web-based Computer-Aided Manufacturing (CAM) application that converts SVG and DXF design files into optimized G-code for CNC plasma cutting operations. The application specifically targets LinuxCNC 2.9+ QtPlasmaC controllers.

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
│  ├─ chain detection controls (tolerance input, detect button)
│  ├─ chains list (with status: open/closed, shape count)
│  ├─ parts list (with hole count)
├─ center column
│  ├─ drawing canvas (chains displayed as paths, no dragging)
├─ right column
│  ├─ cutting parameters (feed rate, pierce settings, etc.)
│  ├─ path information (chain count, part count, cut paths)
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

## Key Technical Context

### Chain Closure Tolerance

**CRITICAL**: Use ONLY the user-set tolerance from the Program page for ALL chain closure detection. Do NOT implement "adaptive tolerance" or any other tolerance calculation based on chain size, complexity, or other factors. The user-set tolerance is the single source of truth for determining if chains are closed.

- Chain closure detection must use exactly the tolerance value set by the user
- Part detection must pass the user tolerance to all chain closure functions
- UI chain status display must use the same user tolerance
- Any "adaptive" or "smart" tolerance calculations are explicitly forbidden

### User-Only Tolerance Setting

**CRITICAL**: ONLY the user sets tolerance values through the 'Tolerance (units)' property on the Program page. Developers must NEVER pick or suggest tolerance values in code or tests to make algorithms work.

- **NEVER** choose tolerances like 20.0, 150.0, etc. in code to make tests pass
- **NEVER** implement tolerance recommendations or automatic adjustments
- **ALWAYS** use the user-provided tolerance from the UI
- If geometry doesn't work with user tolerance, that's the correct behavior - don't override it
- Tests should use realistic default tolerances (0.1) to show actual behavior

### Chain Detection and Processing Rules

**CRITICAL**: Follow these fundamental rules for all chain operations:

- **Always detect AND normalize chains** before doing further analysis on them
- **Make no assumptions** about the 'right' number of chains in a drawing - there could easily be thousands
- **Chains are chains** no matter if they are open or closed - both types are valid chains
- **Only closed chains can form the shell** of a part (outer boundary)
- **Only closed chains can have holes** (inner boundaries within shells)

### Chain Normalization and Closure

**IMPORTANT**: When analyzing chain traversal, coincident points between the first shape (shape 1) and the last shape (final shape) are EXPECTED and CORRECT for closed chains. This is what makes a chain closed - the end point of the last shape should coincide with the start point of the first shape.

- Do NOT report this as an error or warning - this is normal closed chain behavior
- Only report non-sequent shape coincident points as potential ordering issues when they occur between shapes that are not first/last
- Chain normalization should preserve this first/last coincidence for proper closure

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

**CRITICAL**: ALL shapes form chains, including single isolated shapes. Both open and closed shapes form chains. Single shapes that are not connected to other shapes still form single-shape chains. This ensures that every shape in the drawing is part of the chain analysis for tool path generation.

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

### Part Detection Algorithm

#### Critical Design Principles

**USE PROPER GEOMETRIC CONTAINMENT FOR PART DETECTION**

Proper geometric containment is essential for determining part/hole relationships:

1. **Point-in-polygon tests**: Use ray casting or winding number algorithms for accurate containment
2. **Curve intersection analysis**: Detect when boundaries cross or overlap
3. **Area-based validation**: Verify containment using geometric area calculations
4. **Numerical precision**: Handle floating-point errors with appropriate tolerances
5. **Mathematical correctness**: Ensure algorithms follow established geometric principles

**Bounding box checks can be used as a fast preliminary filter** but must always be followed by proper geometric containment verification.

#### Testing Requirements

- **Unit tests for geometric algorithms**: Test mathematical correctness and edge cases
- **Numerical precision validation**: Verify algorithms handle floating-point precision correctly
- **Verify with complex geometries**: Test overlapping, nested, and edge cases

#### Historical Issues

Key requirements for geometric containment:

- Point-in-polygon tests for accurate containment detection
- Proper handling of edge cases and numerical precision
- Mathematical validation of containment relationships

Incorrect approaches to avoid:

- Bounding box-only containment (insufficient for complex shapes)
- Size-based assumptions without geometric verification
- Area ratios without proper containment validation

#### Multi-Layer DXF Files

Some DXF files contain multiple layers where one layer represents the part outline and another represents holes. For proper part detection:

1. **Layer Squashing Required**: All layers must be combined into a single geometry set before part detection
2. **Hole Layers**: Typically contain circular or complex hole patterns
3. **Part Layers**: Contain the main part outline
4. **Processing Order**: Squash layers → detect chains → detect parts/holes

#### Testing Approach

Tests verify:

1. **Correct part/hole counts** for each file
2. **Proper geometric containment** using custom geometric algorithms
3. **Warning generation** for problematic files
4. **Layer handling** for multi-layer files (when implemented)
5. **Chain closure detection** with appropriate tolerances

### DXF Polyline Bulge Handling

**CRITICAL**: DXF polylines and lwpolylines can contain bulge factors that define curved segments between vertices. Proper bulge handling is essential for accurate CAD file rendering.

#### Bulge Factor Mathematics

**Formula**: `bulge = tan(θ/4)` where θ is the included angle of the arc segment

**Sign Convention**:

- **Positive bulge**: Counter-clockwise arc direction (left turn)
- **Negative bulge**: Clockwise arc direction (right turn)
- **Zero bulge**: Straight line segment
- **Special case**: `bulge = ±1.0` creates a perfect semicircle (180°)

#### Testing Requirements

- Test with files containing various bulge magnitudes (±0.1 to ±2.0)
- Verify both CW and CCW arc directions
- Ensure semicircle cases (bulge = ±1.0) render correctly
- Compare visual output between bulge-preserved and decomposed modes

#### Common Files with Bulges

- `Polylinie.dxf`: 16 vertices with 10 non-zero bulges, complex mixed geometry
- `polylines_with_bulge.dxf`: Simple test case with basic bulge scenarios
- `AFluegel Rippen b2 0201.dxf`: Real-world example with intricate curved profiles

### Shape Processing Algorithms

**CRITICAL**: Shape processing algorithms are implemented as separate, standalone functions that operate independently of the DXF parser.

#### Algorithm Separation

**Decompose Polylines Algorithm** (`src/lib/algorithms/decompose-polylines.ts`):

- Converts polyline shapes into individual line and arc segments
- Makes geometry easier to process for CAM operations
- Each segment becomes an independent shape with unique ID
- Preserves layer information and handles closed polylines
- Available as toolbar button in Edit stage

**Translate to Positive Quadrant Algorithm** (`src/lib/algorithms/translate-to-positive.ts`):

- Translates all shapes to ensure they are in the positive quadrant
- Calculates bounding box and moves minimum coordinates to (0,0)
- Only translates when negative coordinates exist
- Handles all shape types (line, circle, arc, polyline, ellipse)
- Available as toolbar button in Edit stage

#### Algorithm Usage

**DXF Import**: Algorithms are NOT automatically applied during file import
**User Control**: Algorithms are only executed when user clicks toolbar buttons in Edit stage
**Independence**: Algorithms work on any Shape[] array, not tied to DXF parsing
**Testing**: Each algorithm has comprehensive test coverage

#### DXF Parser Implementation Details

##### Supported Entity Types

The DXF parser currently supports the following entity types:

- **LINE**: Direct line entities and lines from LINE entity arrays
- **CIRCLE**: Circular entities
- **ARC**: Arc entities with proper angle handling
- **SPLINE**: NURBS curves converted to polylines using control point sampling
- **LWPOLYLINE/POLYLINE**: Lightweight and regular polylines with bulge support
- **INSERT**: Block references with full transformation support

##### INSERT Entity (Block Reference) Support

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

### Cutting Simulation Algorithm

**Purpose**: Provide real-time visual simulation of the cutting process, allowing users to preview tool movement, verify cut sequences, and estimate cutting times before generating G-code.

**Algorithm Definition**:
The simulation algorithm creates a time-based animation that moves a tool head marker along cutting paths and rapid movements at speeds that match the actual feed rates specified in the cutting parameters.

#### Core Animation System

**Real-Time Speed Matching**:

- Tool head moves at the exact speed specified by feed rates (e.g., 100 mm/min = 100mm in 60 seconds)
- Rapid movements use a fixed speed of 3000 mm/min for realistic previews
- Animation runs at 1:1 real-time speed for accurate time estimation

**Animation Step Generation**:

1. **Path Ordering**: Retrieve ordered cutting paths and rapids from optimization algorithm
2. **Time Calculation**: Calculate duration for each movement segment:
   - **Cut paths**: `(pathDistance / feedRate) * 60` - converts units/min to seconds
   - **Rapids**: `(rapidDistance / 3000) * 60` - fixed rapid speed conversion
3. **Step Creation**: Build sequential animation steps with start/end times and movement data
4. **Total Duration**: Sum all step durations for complete simulation time

**Real-Time Animation Loop**:

- Uses `performance.now()` for precise timing measurements
- Calculates delta time between frames for smooth animation
- Updates tool head position based on elapsed time within current animation step
- Resets timing when starting/pausing to prevent time jumps

#### Tool Head Movement Algorithm

**Position Interpolation**: Calculate tool head position along complex geometry types:

**Line Segments**:

```typescript
position = start + (end - start) * progress;
```

**Circular Arcs**:

```typescript
angle = startAngle + (endAngle - startAngle) * progress;
position = center + radius * [cos(angle), sin(angle)];
```

**Polylines**: Walk along vertex sequences with distance-based progress tracking

**Splines**: Use control point interpolation for smooth curved movement

**Progress Tracking**:

- Calculate cumulative distance along multi-shape chains
- Determine which shape contains the current tool position
- Interpolate position within the current shape based on remaining distance

#### Visual Feedback System

**Tool Head Representation**:

- Red cross marker (±10 pixel size) indicating current tool position
- Real-time position updates at 60fps for smooth movement
- Proper coordinate transformation to match drawing scale and units

**Operation Status Display**:

- **"Ready"** - Simulation loaded but not started
- **"Rapid Movement"** - Tool moving at rapid speed between cuts
- **"Cutting (X units/min)"** - Tool cutting at specified feed rate
- **"Complete"** - Simulation finished successfully

**Progress Information**:

- Real-time progress percentage based on elapsed vs. total time
- Current time display in MM:SS format
- Visual progress indicator for simulation completion

#### Performance Optimizations

**Efficient Shape Processing**:

- Pre-calculate total distances for all paths during initialization
- Cache shape geometry calculations to avoid repeated computations
- Use efficient distance formulas optimized for each shape type

**Memory Management**:

- Proper cleanup of animation frames and store subscriptions
- Prevention of memory leaks during component destruction
- Safeguards against operations after component unmounting

**Canvas Rendering**:

- Efficient drawing updates only when position changes
- Proper canvas coordinate transformations for zoom/pan support
- Optimized redraw cycles to maintain 60fps performance

#### Integration with CAM Workflow

**Input Data Sources**:

- **Paths**: Ordered cutting paths from operations store with feed rates
- **Rapids**: Optimized rapid movements from cut order algorithm
- **Chains**: Shape geometry data for tool movement calculation
- **Drawing**: Canvas scaling and coordinate system information

**Workflow Integration**:

- Automatic stage completion when simulation finishes
- Navigation controls respect workflow state management
- Real-time synchronization with store updates

**Quality Assurance**:

- Accurate time estimation for production planning
- Visual verification of cut sequences before G-code generation
- Detection of potential cutting issues through real-time preview

#### Technical Implementation

**File Location**: `src/components/stages/SimulateStage.svelte`

**Key Functions**:

- `buildAnimationSteps()`: Convert paths/rapids into time-based animation data
- `animate()`: Main real-time animation loop with precise timing
- `updateToolHeadPosition()`: Calculate tool position for current time
- `getPositionOnShape()`: Interpolate position along specific geometry types

**State Management**:

- Animation state (playing, paused, stopped) with proper controls
- Real-time tool head position tracking
- Progress and timing information for user feedback

**Testing Coverage**:

- Store subscription cleanup to prevent memory leaks
- Navigation safety when leaving simulation stage
- Animation timing accuracy and real-time speed matching

#### Algorithm Complexity

**Initialization**: O(n) where n is the number of paths and rapids
**Animation Loop**: O(1) per frame - constant time position updates
**Shape Interpolation**: O(1) for simple shapes, O(m) for polylines with m vertices

**Memory Usage**: Linear with respect to number of animation steps (paths + rapids)

This simulation system provides manufacturing professionals with accurate cutting previews, enabling confident G-code generation and optimal production planning.
