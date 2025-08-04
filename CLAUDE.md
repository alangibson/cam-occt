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

**Key Features**:
- **Path Creation**: All paths are tool paths describing where the tool head will move
- **Cut vs Rapids**: Paths that cut are "cut paths", non-cutting paths are "rapids"
- **Path Components**: Each path consists of a chain + motion parameters
- **Motion Parameters**: Minimally include speed (feed rate), optionally tool height (cut height)
- **Plasma Cut Parameters**: Pierce Height (units), Pierce Delay (s), Arc voltage, Kerf Width (units), THC enable
- **Path Enhancements**: Lead-in Length (units), Lead-out Length (units), Overcut Length (units)
- **Default Behavior**: Display chains as paths with no attached cutting parameters initially
- **Automatic Detection**: Auto-detect chains and parts from imported drawing geometry
- **Interactive Parameters**: User-configurable tolerance and cutting parameters

## Operations and Paths Relationship

**CRITICAL**: Understanding the relationship between Operations and Paths is fundamental to the Program Stage workflow:

### Operations
- **Operations** are user-defined instructions that specify HOW to cut geometry
- An operation defines which tool to use and which chains/parts to cut
- Operations contain cutting parameters (feed rate, pierce settings, etc.)
- Operations are created by the user in the Operations box in the Program stage
- Operations are ALWAYS automatically applied - no manual "apply" button needed

### Paths  
- **Paths** are automatically generated FROM operations when they are created or modified
- Each operation targeting chains creates one path per chain
- Each operation targeting parts creates paths for all chains that make up the part (shell + holes)
- Paths represent the actual tool movement instructions
- Paths are displayed in the Paths box in the Program stage below Operations

### Visual Display
- **Chains with paths are highlighted in GREEN** on the drawing canvas
- **Selected paths are highlighted in DARK GREEN** on the drawing canvas
- This allows users to visually see which geometry has tool paths generated

### Workflow
1. User creates operation and assigns it to chains or parts
2. System automatically generates paths from the operation
3. Chains with paths appear green on the canvas
4. User can select/highlight paths to see them in dark green
5. Paths contain all the tool movement data for G-code generation

## Drawing Canvas Synchronization

**CRITICAL**: The drawing canvas must ALWAYS be kept up to date with the state the user sets in the left and right columns.

## Drawing Canvas Origin Positioning

**CRITICAL**: The drawing origin position on screen must remain consistent and predictable:

### Fixed Origin Position
- **Screen Position**: Drawing origin is positioned at 25% from left edge, 75% from top edge of canvas
- **Independence**: Origin position is completely independent of left/right column widths
- **Consistency**: Origin stays in the same screen position across all workflow stages
- **User Control**: Origin position only changes when user pans (middle/right mouse button drag)

### Implementation Details
- **Canvas Transform**: Uses fixed percentage-based origin calculation instead of center-based
- **Coordinate Conversion**: `screenToWorld()` function uses same fixed origin for accurate mouse interactions
- **Zoom Behavior**: Zoom-to-mouse functionality maintains fixed origin reference point
- **Resize Handling**: Canvas resizing no longer triggers offset adjustments - origin stays put

### Benefits
- **Predictable UX**: Users always know where the drawing origin will appear
- **Layout Independence**: Column resizing doesn't affect drawing position
- **Cross-Stage Consistency**: Same drawing appears in same screen location on all stages
- **Pan-Only Movement**: Only user panning can change what's visible, not UI layout changes

### Canvas Reactivity Requirements
- **Operations State**: Canvas highlighting must immediately reflect when operations are enabled/disabled
- **Path State**: Green highlighting appears/disappears instantly when paths are created/deleted
- **Selection State**: Canvas selection must sync with selections in the left/right panels
- **Real-time Updates**: Any change in the side panels must be immediately visible on the canvas

### Synchronization Rules
- **Disabled Operations**: Chains/parts associated with disabled operations must NOT appear green
- **Deleted Operations**: Canvas must immediately remove highlighting when operations are deleted
- **Path Generation**: New paths must immediately appear as green highlighting when operations are applied
- **Selection Sync**: Hover/selection in panels must highlight corresponding geometry on canvas
- **State Consistency**: Canvas state must never be out of sync with panel state

### Implementation Notes
- Use reactive statements (`$:`) to ensure canvas updates when stores change
- Filter displayed paths based on both path existence AND operation enabled state
- Remove paths from display when their parent operations no longer exist
- Maintain strict synchronization between UI panels and canvas visualization

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

### Layout Behavior

- **Header**: Always visible, shows current workflow stage via breadcrumbs
- **Body**: Content changes completely based on workflow stage
- **Footer**: Always visible, may show different information per stage
- **Navigation**: Users progress through stages sequentially (Import → Edit → Program → Simulate → Export)
- **State Management**: Each stage maintains its own state while preserving data from previous stages

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
├── src/                   # Source code
│   ├── lib/               # Shared libraries and utilities
│   ├── routes/            # SvelteKit routes
│   └── app.html           # Main HTML template
├── tests/                 # Test files
│   ├── dxf/               # DXF test files for testing import functionality
│   └── e2e/               # End-to-end Playwright tests
├── reference/             # Reference implementations and third-party library docs
├── scripts/               # Build scripts, migrations, and utilities (if needed)
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.js         # Vite configuration
├── svelte.config.js       # SvelteKit configuration
├── playwright.config.ts   # Playwright configuration
└── vitest.config.ts       # Vitest configuration
```

**Root Directory Rules**:
- **ONLY configuration files** should exist in the root (package.json, tsconfig.json, *.config.*)
- **NO test files** in root - they go in src/ alongside code or in tests/
- **NO temporary scripts** in root - use scripts/ directory or delete after use
- **NO debug files** in root - convert to proper tests

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

**STRICTLY FORBIDDEN**: Creating workarounds, fallbacks, or disabling functionality when algorithms are broken:
- Do NOT disable bulge-to-arc conversion and fall back to lines because the algorithm is incorrect
- Do NOT create "temporary" solutions that change expected behavior 
- Do NOT update tests to accept broken behavior instead of fixing the underlying algorithm
- Fix the mathematical/algorithmic problems directly, even if complex
- Broken algorithms must be fixed, not bypassed

## UI Changes and Testing

**CRITICAL**: After making any changes to the UI (layout, components, styling, text content), you MUST:
1. **Run Svelte/Vite build check** with `npm run build` to ensure no compilation errors
2. **Run unit tests** with `npm run test` to catch any TypeScript or logic errors
3. **Rerun all e2e Playwright tests** to ensure they still pass
4. **Fix any failing tests** caused by UI changes (selectors, text expectations, layout changes)
5. **Update test expectations** if the UI changes are intentional
6. **Verify screenshot tests** still capture the correct visual elements

**NEVER tell the user you are done without running these tests first.** UI changes frequently break e2e tests due to changed selectors, moved elements, or different text content. Build errors are common when adding new components or imports.

## Testing Requirements Before Reporting Completion

**CRITICAL**: Before reporting that any functionality is "fixed" or "complete" to the user, you MUST:

1. **Run ALL relevant tests** to verify the fix actually works
2. **Verify that existing functionality still works** (regression testing)
3. **Update test expectations** to match the correct behavior, not broken behavior
4. **Only report success** when tests actually pass with the expected correct behavior

**NEVER claim something is fixed without running tests to verify it works.** Always run tests before making claims about functionality being complete or working correctly.

## Test Writing Guidelines

**CRITICAL**: Tests must be written based on USER REQUIREMENTS, not current broken behavior:

1. **Write tests for the CORRECT expected behavior** as specified by user requirements
2. **DO NOT change test expectations just to make tests pass** - this defeats the entire purpose of testing
3. **Tests should FAIL when functionality is broken** and PASS when functionality works correctly
4. **Use tests to drive development** - implement functionality until tests pass with correct behavior
5. **Document current broken behavior separately** but do not make tests expect broken behavior

**NEVER modify tests to match broken code.** Tests must reflect what the user wants the system to do, not what it currently does wrong.

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

#### Test File Organization Rules

**CRITICAL**: Test files must be properly organized to maintain a clean codebase:

1. **NO test files in the root directory** - Test files (*.test.*, *.spec.*, test-*.*, debug-*.*) MUST be placed in their proper locations
2. **Unit tests go alongside source files** - `src/lib/foo.ts` → `src/lib/foo.test.ts`
3. **Integration tests go in test directories** - Complex integration tests go in relevant subdirectories
4. **E2E tests go in tests/e2e/** - All end-to-end tests must be in the dedicated e2e directory
5. **Test utilities go in test directories** - Helper functions and utilities for tests go alongside the tests that use them

**FORBIDDEN**: Creating test files in the root directory for any reason, including:
- Quick debugging scripts (use proper test files instead)
- Temporary test files (create them in the proper location from the start)
- Migration or utility scripts (these should be in a tools/ or scripts/ directory if needed temporarily)

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

**CRITICAL**: For G-code generation targeting LinuxCNC QtPlasmaC plasma controllers, refer to the comprehensive documentation at `reference/linuxcnc/QtPlasmaC.html` for complete specifications on:

- QtPlasmaC-specific M-codes and G-codes
- Torch height control (THC) implementation
- Pierce delays and plasma control sequences
- Ohmic sensing control
- Cut height and pierce height management
- Kerf width compensation integration
- Arc voltage control and monitoring

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

### Working with Temporary Scripts and Utilities

**CRITICAL**: Temporary scripts and utilities must be properly managed:

1. **Migration Scripts**: If you need to create migration scripts (e.g., for updating test formats), place them in a `scripts/` or `tools/` directory
2. **Debug Scripts**: Debug scripts should be converted to proper unit tests in the appropriate location
3. **Cleanup Required**: After running any migration or utility script, it MUST be either:
   - Deleted if it's a one-time use script
   - Moved to `scripts/` directory if it might be needed again
   - Converted to a proper npm script in package.json if it's a recurring task
4. **NO orphaned files**: Never leave utility scripts, test files, or temporary files in the root directory

**FORBIDDEN**: Leaving any of these files in the root directory:
- Migration scripts (migrate-*.*, fix-*.*, update-*.*)
- Debug files (debug-*.*, test-*.*, tmp-*.*)
- Utility scripts (*.cjs, *.mjs in root that aren't config files)
- Temporary test files

**Best Practice**: When creating any temporary file:
1. Create it in the appropriate directory from the start
2. Add a clear comment at the top explaining its purpose
3. Delete it immediately after use OR move it to proper location
4. Never commit temporary files to version control

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

## References

Documentation for key libraries is available in `./references` (when present):
- Three.js examples and guides
- DXF format specifications
- LinuxCNC G-code reference
- Geometric algorithm references
- MetalHeadCam for working examples at ./reference/MetalHeadCAM

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

## Selection and Highlighting Synchronization

**CRITICAL**: All selection and highlighting operations must be synchronized across all UI components:

### Core Selection Principle

**FUNDAMENTAL RULE**: When any object is selected in a sidebar column (left or right), it MUST also be visually selected/highlighted on the drawing canvas. This applies to:
- **Parts** selected in Parts list → highlighted on canvas
- **Chains** selected in Chains list → highlighted on canvas  
- **Paths** selected in Paths list → highlighted on canvas
- **Rapids** selected in Cut Order list → highlighted on canvas

This bidirectional synchronization ensures users always know which object they're working with across all UI components.

- **Part Highlighting**: When a part is highlighted in any component (Operations apply-to menu, Program stage parts list, etc.), the same part must be highlighted in:
  - Drawing canvas (visual highlighting)
  - Parts list in Program stage (highlighted background)
  - Any other UI components showing part information

- **Path/Chain Selection**: When a path (chain) is selected in any component, the same path must be selected in:
  - Drawing canvas (visual selection styling)
  - Paths list in Program stage (selected background)
  - Any other UI components showing path information

- **Rapid Selection**: When a rapid is selected in any component (Cut Order box, etc.), the same rapid must be selected in:
  - Drawing canvas (visual highlighting of the rapid line)
  - Cut Order list in Program stage (selected background)
  - Any other UI components showing rapid information

- **Implementation Requirements**:
  - Use the shared store functions: `highlightPart(partId)`, `clearHighlight()` for parts
  - Use the shared store functions: `selectChain(chainId)` for paths/chains
  - Use the shared store functions: `selectRapid(rapidId)`, `highlightRapid(rapidId)`, `clearRapidHighlight()` for rapids
  - Never create local selection state that doesn't sync with stores
  - Always test that hover/selection in one component updates all other relevant components

- **Testing Requirements**:
  - Verify that hovering over a part in the Operations apply-to menu highlights the part in the drawing canvas
  - Verify that hovering over a path in the Operations apply-to menu selects the path in the drawing canvas
  - Verify that clicking on a rapid in the Cut Order box selects and highlights the rapid line on the drawing canvas
  - Test all selection interactions across multiple UI components to ensure synchronization

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

## Display Units and Physical Scaling

**CRITICAL**: The application implements proper unit handling to ensure accurate physical representation of CAD drawings on screen.

### Hard Requirement: Physical Size Accuracy at 100% Zoom

**CRITICAL REQUIREMENT**: At 100% zoom (scale = 1), the drawing MUST appear on screen at the exact physical size reported in the footer. For example:
- ADLER.dxf reports 186.2 × 60.9 mm in the footer
- At 100% zoom with display units = mm, the drawing MUST measure exactly 186.2mm wide when measured with a physical ruler on screen
- Column resizing, container changes, or any other UI operations MUST NOT affect the physical size of the drawing
- The drawing size on screen is determined ONLY by: drawing geometry + display unit setting + zoom level
- Container size changes should only affect how much of the drawing is visible (viewport), not the drawing's physical scale

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

### Fallback and Simplification Approval Requirement

**CRITICAL**: All fallbacks, workarounds, and geometric simplifications in algorithms must be explicitly approved by the user before implementation.

The user must review and approve each proposed fallback or simplification to ensure it meets the application's accuracy requirements. Document all approved fallbacks with clear explanations of when and why they are used.
