# CAM-OCCT Development Guide

## Project Overview

CAM-OCCT is a web-based Computer-Aided Manufacturing (CAM) application that converts SVG and DXF design files into optimized G-code for CNC plasma cutting operations. The application specifically targets LinuxCNC 2.9+ QtPlasmaC controllers.

## Core Principles

- **Fix problems at root**: No workarounds, fallbacks, or disabling functionality when algorithms are broken
- **Test-driven development**: Write tests for correct behavior first, never modify tests to match broken code
- **UI changes require testing**: Always run build, unit tests, and e2e tests after UI modifications

## User Workflow Stages

The application implements a complete 6-stage workflow from DXF import to G-code export:

### 1. Import Stage
- DXF/SVG import with drag-and-drop interface
- Unit detection from DXF `$INSUNITS` header  
- File validation and error handling
- Support for all standard DXF entities

### 2. Edit Stage
- Shape selection with orange hover/selection highlighting
- Display unit switching (mm/inch) with accurate physical scaling
- Layer management with visibility controls
- Properties panel showing detailed shape information

### 3. Prepare Stage
- Automatic chain detection from connected shapes
- Part detection (shells with holes)
- User-configurable tolerance for chain closure
- Chain analysis with optimization tools

### 4. Program Stage
- Operations management with plasma cutting parameters
- Automatic path generation with green canvas highlighting
- Advanced lead-in/lead-out with line/arc geometry
- Cut order optimization and rapid generation

### 5. Simulate Stage
- Real-time 3D cutting simulation with Three.js
- Animated tool head movement and progress tracking
- Timeline controls (play, pause, scrub, speed)
- Visual cut path tracing

### 6. Export Stage
- LinuxCNC QtPlasmaC G-code generation
- Plasma-specific M-codes and THC control
- G-code preview with download functionality
- Export summary and safety checklist

## Technical Architecture

### Operations and Paths

**Operations** are user instructions that specify HOW to cut geometry:
- Define tool and cutting parameters (feed rate, pierce settings, etc.)
- Target specific chains or parts
- Automatically applied when created/modified

**Paths** are generated FROM operations:
- One path per chain for chain operations
- Multiple paths for part operations (shell + holes)
- Displayed with green highlighting on canvas
- Selected paths shown in dark green

### Canvas Requirements

The drawing canvas must maintain perfect synchronization with UI state:

**Fixed Origin Position**:
- Origin at 25% from left, 75% from top of canvas
- Independent of column widths or UI layout
- Only changes via user panning

**Real-time Synchronization**:
- Operations enabled/disabled → immediate canvas update
- Path creation/deletion → instant green highlighting change
- Selection in panels → corresponding canvas highlight
- Use reactive statements (`$:`) for automatic updates

**Selection Synchronization**:
When any object is selected in UI panels, it MUST be highlighted on canvas:
- Parts list → canvas part highlighting
- Chains list → canvas chain selection
- Paths list → canvas path selection
- Cut Order rapids → canvas rapid highlighting

### Chain Processing Rules

- Both open and closed chains are valid
- Only closed chains can be part shells or have holes
- Use ONLY user-set tolerance for closure detection
- First/last point coincidence is EXPECTED for closed chains
- Always detect AND normalize chains before analysis in unit tests

## Development Guidelines

### Dos and Donts

- Don't duplicate code. Put it in one place and export/import it.
- Don't catch errors and hide them. Let them bubble up if you can't handle them.
- Obey commands to use specific libraries. Don't substitute or do your own implementation because you have trouble with the API.
- If you cannot figure out an API, request specific documentation.
- Don't create fallbacks unless told to do so.
- Never "temporarily disable" anything.
- Never create placeholder implementations.

### Code Organization

- Components: `src/components/`
- Libraries: `src/lib/`
- Types: `src/types/`
- Routes: `src/routes/`
- Tests: Alongside source files or in `tests/`

### Testing Strategy

**Unit Tests**: 
- Place next to source files (`foo.ts` → `foo.test.ts`)
- Run with `npm run test`

**E2E Tests**:
- All in `tests/e2e/`
- Run with `npm run test:e2e`

**Test File Rules**:
- NO test files in root directory
- NO temporary scripts in root
- Convert debug scripts to proper tests

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run unit tests
npm run test:e2e     # Run e2e tests
npm run check        # Svelte type checking
npm run typecheck    # TypeScript type checking
npm run validate     # Run all validation checks
```

### Development Server

Never run `npm run dev` - the user manages the dev server. If you need it running, ask the user to start it.

### Bug Fix Process

1. Write automated test that catches the error
2. Fix the bug
3. Run test to verify
4. Report completion or iterate

## Testing Guidelines

### Dos and Donts

- Do not change tests, or make them simpler, just to make them pass. If needed create a new simpler test.
- Use exact integer coordinates in tests wherever possible. When points should meet, don't make them 'close enough'
- Don't create debug scripts. Just write vitest tests.

### Validation

- Do not mark human validation tasks done until they have been approved.

## Implementation Notes

### Tolerance Handling

**User-Only Tolerance**: The user sets tolerance via the 'Tolerance (units)' field on the Program page. Never pick tolerance values in code or tests. Use the exact user-provided value for all chain closure detection.

### Shape System

**Shape Origins**:
- Circle/Arc/Ellipse: center point
- Line: start point
- Polyline/Spline: first point

**Shape Colors**:
- Normal: Black (`#000000`) 1px
- Hovered: Orange (`#ff6600`) 1.5px
- Selected: Orange (`#ff6600`) 2px
- Origin cross: Gray (`#888888`) 1px

**Hit Detection**: All shapes must implement `isPointNearShape()` with consistent tolerance scaled by zoom.

### Unit System

**Physical Size Requirement**: At 100% zoom, drawings MUST appear at exact physical size on screen. A 186.2mm drawing must measure 186.2mm with a physical ruler when display unit = mm.

**Unit Detection**: 
- DXF `$INSUNITS`: 1=inch, 4=mm, others default to mm
- Display unit controls visual scale
- Unit switching changes physical interpretation, not geometry data

**Scaling**:
```typescript
const physicalScale = getPhysicalScaleFactor(drawing.units, displayUnit);
const totalScale = zoomScale * physicalScale;
```

### Geometry Processing

Use mathematically sound algorithms for:
- Bounding boxes, boolean operations, containment detection
- Offset calculations, distance calculations
- Complex curves (arcs, splines, NURBS)
- Always unit test edge cases and numerical precision

### G-code Generation

Refer to `reference/linuxcnc/QtPlasmaC.html` for LinuxCNC QtPlasmaC specifications including M-codes, THC control, pierce delays, and arc voltage control.

## Project Structure

```
cam-occt/
├── src/
│   ├── lib/
│   ├── routes/
│   └── components/
├── tests/
│   ├── dxf/
│   └── e2e/
├── reference/
└── [config files]
```

## Key Technologies

- Frontend: Svelte 5 + TypeScript
- Styling: Tailwind CSS
- 3D: Three.js
- Build: Vite + SvelteKit
- Testing: Vitest + Playwright

## Performance & Security

- Keep bundle under 500KB
- Use Web Workers for heavy computation
- Validate all file inputs
- Target modern browsers only (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

## References

- Three.js docs
- DXF specifications
- LinuxCNC G-code reference
- MetalHeadCAM examples at `./reference/MetalHeadCAM`

## Definitions

- Spline: synonym for a NURBS
