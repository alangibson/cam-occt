# CAM-OCCT Development Guide

## Project Overview

CAM-OCCT is a web-based Computer-Aided Manufacturing (CAM) application that converts SVG and DXF design files into optimized G-code for CNC plasma cutting operations. The application specifically targets LinuxCNC 2.9+ QtPlasmaC controllers.

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
├── .claude/               # Claude-specific documentation (if exists)
│   └── docs/              # Third-party library docs
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

3. **Cut programming**
   - Basic cutting parameters
   - Apply cutting parameters to shapes to create tool paths

4. **Cut Path Generation**
   - Basic path optimization (minimize rapid movements)
   - Lead-in/lead-out generation
   - Cut sequencing

5. **G-code Export**
   - LinuxCNC compatible output

#### Phase 2 (Optimization)
1. **Advanced Optimization**
   - Nesting algorithms
   - Hole detection and specialized processing
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

## Common Pitfalls to Avoid

- Don't assume file formats are standard - always validate
- Avoid blocking the main thread with heavy computations
- Don't trust user input - validate and sanitize
- Remember browser memory limits with large files
- Test with real-world DXF files, not just simple shapes
- Consider touch device support from the start