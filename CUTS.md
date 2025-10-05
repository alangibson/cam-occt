# Path to Cut Renaming Plan

## Overview

Rename the `Path` interface and all semantically related code to `Cut` throughout the codebase. The `Path` interface represents cutting operations generated from operations, distinct from `CutPath` (the low-level toolpath representation) and unrelated path concepts (file paths, SVG paths).

## Why This Rename?

- **Clarity**: "Cut" more accurately describes what these objects represent - instructions for cutting operations
- **Avoid Confusion**: Distinguishes from `CutPath` (toolpath), file paths, and SVG paths
- **Domain Language**: Aligns with CAM terminology where "cuts" are the operations performed

---

## Phase 1: Directory and File Structure

### Directories to Rename

- [ ] `/src/lib/stores/paths/` → `/src/lib/stores/cuts/`
- [ ] `/src/lib/cam/path-generator/` → `/src/lib/cam/cut-generator/`

### Files to Rename

#### Store Files

- [ ] `src/lib/stores/paths/paths.test.ts` → `src/lib/stores/cuts/cuts.test.ts`

#### Cut Generator Files

- [ ] `src/lib/cam/path-generator/path-generator.ts` → `src/lib/cam/cut-generator/cut-generator.ts`
- [ ] `src/lib/cam/path-generator/path-generator.test.ts` → `src/lib/cam/cut-generator/cut-generator.test.ts`
- [ ] `src/lib/cam/path-generator/path-to-toolpath.ts` → `src/lib/cam/cut-generator/cut-to-toolpath.ts`
- [ ] `src/lib/cam/path-generator/path-to-toolpath.test.ts` → `src/lib/cam/cut-generator/cut-to-toolpath.test.ts`

#### Optimization Utilities

- [ ] `src/lib/algorithms/optimize-start-points/path-optimization-utils.ts` → `cut-optimization-utils.ts`
- [ ] `src/lib/algorithms/optimize-start-points/path-optimization-utils.test.ts` → `cut-optimization-utils.test.ts`
- [ ] `src/lib/algorithms/optimize-start-points/path-optimization-utils.branch-coverage.test.ts` → `cut-optimization-utils.branch-coverage.test.ts`

#### Components

- [ ] `src/components/Paths.svelte` → `src/components/Cuts.svelte`
- [ ] `src/components/PathProperties.svelte` → `src/components/CutProperties.svelte`
- [ ] `src/components/Paths.function-coverage.test.ts` → `src/components/Cuts.function-coverage.test.ts`
- [ ] `src/components/PathsBasic.test.ts` → `src/components/CutsBasic.test.ts`

#### Renderers

- [ ] `src/lib/rendering/canvas/renderers/path.ts` → `src/lib/rendering/canvas/renderers/cut.ts`

---

## Phase 2: Type Definitions and Interfaces

### `src/lib/stores/cuts/interfaces.ts`

- [ ] `interface Path` → `interface Cut`
- [ ] `interface PathsState` → `interface CutsState`
- [ ] `interface PathsStore` → `interface CutsStore`
- [ ] Update JSDoc comments: "Path Store" → "Cut Store"

### `src/lib/stores/operations/interfaces.ts`

- [ ] `type PathLeadResult` → `type CutLeadResult`
- [ ] Update references in interface definitions

### `src/lib/rendering/canvas/utils/hit-test.ts`

- [ ] `HitTestType.PATH` → `HitTestType.CUT`
- [ ] Update enum JSDoc comments

### `src/lib/rendering/canvas/layers/types.ts`

- [ ] `LayerId.PATHS` → `LayerId.CUTS`
- [ ] Update layer configuration comments

### `src/lib/rendering/canvas/renderers/cut.ts`

- [ ] `class PathRenderer` → `class CutRenderer`
- [ ] Update constructor and JSDoc

---

## Phase 3: Store Implementation

### `src/lib/stores/cuts/store.ts`

#### Function Names

- [ ] `createPathsStore` → `createCutsStore`
- [ ] Export: `pathStore` → `cutStore`

#### Store Methods

- [ ] `addPath` → `addCut`
- [ ] `updatePath` → `updateCut`
- [ ] `deletePath` → `deleteCut`
- [ ] `deletePathsByOperation` → `deleteCutsByOperation`
- [ ] `selectPath` → `selectCut`
- [ ] `highlightPath` → `highlightCut`
- [ ] `reorderPaths` → `reorderCuts`
- [ ] `getPathsByChain` → `getCutsByChain`
- [ ] `getChainsWithPaths` → `getChainsWithCuts`
- [ ] `updatePathLeadGeometry` → `updateCutLeadGeometry`
- [ ] `clearPathLeadGeometry` → `clearCutLeadGeometry`
- [ ] `updatePathOffsetGeometry` → `updateCutOffsetGeometry`
- [ ] `clearPathOffsetGeometry` → `clearCutOffsetGeometry`

#### Variables and Parameters

- [ ] All `path` parameters → `cut`
- [ ] All `paths` arrays → `cuts`
- [ ] `newPaths` → `newCuts`
- [ ] `currentPaths` → `currentCuts`
- [ ] `pathId` → `cutId`
- [ ] `selectedPathId` → `selectedCutId`
- [ ] `highlightedPathId` → `highlightedCutId`

### `src/lib/stores/cuts/functions.ts`

- [ ] Function signature: `checkProgramStageCompletion(paths: Path[])` → `checkProgramStageCompletion(cuts: Cut[])`
- [ ] JSDoc: "Path Store Helper Functions" → "Cut Store Helper Functions"

---

## Phase 4: Function Renames

### `src/lib/cam/cut-generator/cut-to-toolpath.ts`

- [ ] `pathToToolPath` → `cutToToolPath`
- [ ] `pathsToToolPaths` → `cutsToToolPaths`
- [ ] JSDoc: "Convert a Path from the path store" → "Convert a Cut from the cut store"
- [ ] All function parameters and variables

### `src/lib/rendering/canvas/utils/renderer-utils.ts`

- [ ] `isPathEnabledForRendering` → `isCutEnabledForRendering`
- [ ] `applyPathStyling` → `applyCutStyling`
- [ ] Function parameters and comments

### `src/lib/algorithms/optimize-start-points/cut-optimization-utils.ts`

- [ ] All function names containing "path"
- [ ] All parameters and variables
- [ ] Update JSDoc comments

---

## Phase 5: Component Updates

### `src/components/Cuts.svelte`

#### Script Section

- [ ] Import: `pathStore` → `cutStore`
- [ ] Import: `type Path` → `type Cut`
- [ ] Variable: `paths` → `cuts`
- [ ] Variable: `selectedPathId` → `selectedCutId`
- [ ] Variable: `highlightedPathId` → `highlightedCutId`
- [ ] Variable: `draggedPath` → `draggedCut`
- [ ] Functions: `handlePathClick` → `handleCutClick`
- [ ] Functions: `handlePathHover` → `handleCutHover`
- [ ] All other path variables

#### CSS Classes

- [ ] `.paths-container` → `.cuts-container`
- [ ] `.paths-list` → `.cuts-list`
- [ ] `.path-item` → `.cut-item`
- [ ] `.path-header` → `.cut-header`
- [ ] `.path-name` → `.cut-name`
- [ ] `.path-details` → `.cut-details`
- [ ] `.path-info` → `.cut-info`
- [ ] `.operation-name` (keep as is)
- [ ] `.path-order` → `.cut-order`
- [ ] `.no-paths` → `.no-cuts`

#### HTML Attributes

- [ ] `data-path-id` → `data-cut-id`

#### UI Text

- [ ] "No paths generated yet." → "No cuts generated yet."
- [ ] "Apply operations to chains or parts to generate tool paths." → "Apply operations to chains or parts to generate cuts."

### `src/components/CutProperties.svelte`

- [ ] Import: `pathStore` → `cutStore`
- [ ] Import: `type Path` → `type Cut`
- [ ] Variable: `paths` → `cuts`
- [ ] Variable: `selectedPathId` → `selectedCutId`
- [ ] Variable: `selectedPath` → `selectedCut`
- [ ] Function: `copyPathToClipboard` → `copyCutToClipboard`
- [ ] CSS class: `.path-properties` → `.cut-properties`
- [ ] All other path references

### `src/components/stages/ProgramStage.svelte`

- [ ] Import: `pathStore` → `cutStore`
- [ ] All variable references
- [ ] UI text updates

### `src/components/InspectPanel.svelte`

- [ ] Update Path-related imports and references

### `src/components/DrawingCanvas.svelte`

- [ ] Import: `PathRenderer` → `CutRenderer`
- [ ] Update renderer instantiation
- [ ] Update state references

### `src/components/GCodeExport.svelte`

- [ ] Update imports from cut-generator
- [ ] Update function calls and variables

### `src/components/LeadVisualization.svelte`

- [ ] Update Path imports and references

---

## Phase 6: Rendering System Updates

### `src/lib/rendering/canvas/state/render-state.ts`

- [ ] `pathsState?: PathsState` → `cutsState?: CutsState`
- [ ] Update JSDoc comments

### `src/lib/rendering/canvas/pipeline.ts`

- [ ] Import: `PathRenderer` → `CutRenderer`
- [ ] Renderer instantiation
- [ ] Layer references: `LayerId.PATHS` → `LayerId.CUTS`

### `src/lib/rendering/canvas/renderers/cut.ts`

- [ ] Class: `PathRenderer` → `CutRenderer`
- [ ] JSDoc: "PathRenderer handles rendering of paths" → "CutRenderer handles rendering of cuts"
- [ ] Function: `drawOffsetPaths` → `drawOffsetCuts`
- [ ] Function: `drawPathEndpoints` → `drawCutEndpoints`
- [ ] Comments: "offset paths" → "offset cuts"
- [ ] Variables: `path` → `cut`, `paths` → `cuts`
- [ ] `enabledPaths` → `enabledCuts`
- [ ] `isPathSelected` → `isCutSelected`
- [ ] `isPathHighlighted` → `isCutHighlighted`
- [ ] Color constants: `pathColors` → `cutColors`

### `src/lib/rendering/canvas/renderers/lead.ts`

- [ ] Update Path imports and references

### `src/lib/rendering/canvas/renderers/chevron.ts`

- [ ] Update Path imports and references

### `src/lib/rendering/canvas/utils/renderer-utils.ts`

- [ ] `isPathEnabledForRendering` → `isCutEnabledForRendering`
- [ ] `applyPathStyling` → `applyCutStyling`
- [ ] Parameter: `path: Path` → `cut: Cut`

---

## Phase 7: Import/Export Updates

### Files Importing from `$lib/stores/paths`

Update imports in these ~48 files:

- [ ] `src/lib/stores/operations/interfaces.ts`
- [ ] `src/lib/stores/operations/functions.ts`
- [ ] `src/lib/stores/operations/store.ts`
- [ ] `src/lib/rendering/canvas/state/render-state.ts`
- [ ] `src/lib/rendering/canvas/renderers/cut.ts`
- [ ] `src/components/DrawingCanvas.svelte`
- [ ] `src/components/CutProperties.svelte`
- [ ] `src/components/stages/ProgramStage.svelte`
- [ ] `src/components/GCodeExport.svelte`
- [ ] `src/components/Cuts.svelte`
- [ ] `src/lib/rendering/canvas/renderers/lead.ts`
- [ ] `src/components/InspectPanel.svelte`
- [ ] `src/lib/rendering/canvas/renderers/chevron.ts`
- [ ] `src/lib/stores/chains/functions.ts`
- [ ] `src/lib/rendering/canvas/utils/renderer-utils.ts`
- [ ] `src/components/stages/SimulateStage.svelte`
- [ ] `src/lib/algorithms/leads/functions.ts`
- [ ] `src/lib/utils/lead-persistence-utils.ts`
- [ ] `src/lib/cam/cut-generator/cut-to-toolpath.ts`
- [ ] `src/lib/algorithms/optimize-start-points/cut-optimization-utils.ts`
- [ ] `src/lib/stores/storage/interfaces.ts`
- [ ] `src/lib/stores/storage/store.ts`
- [ ] `src/components/LeadVisualization.svelte`
- [ ] All test files (20+ files)

---

## Phase 8: Test Updates

### Test Descriptions and Variables

- [ ] `src/lib/stores/cuts/cuts.test.ts`
- [ ] `src/lib/cam/cut-generator/cut-generator.test.ts`
- [ ] `src/lib/cam/cut-generator/cut-to-toolpath.test.ts`
- [ ] `src/lib/algorithms/optimize-start-points/cut-optimization-utils.test.ts`
- [ ] `src/lib/algorithms/optimize-start-points/cut-optimization-utils.branch-coverage.test.ts`
- [ ] `src/components/Cuts.function-coverage.test.ts`
- [ ] `src/components/CutsBasic.test.ts`
- [ ] `src/components/stages/SimulateStage.test.ts`
- [ ] `src/components/stages/SimulateStage.offset.test.ts`
- [ ] `src/components/stages/SimulateStage.cut-direction.test.ts`
- [ ] `src/components/stages/ProgramStage.test.ts`
- [ ] `src/components/cut-direction-integration.test.ts`
- [ ] `src/components/GCodeExport.test.ts`
- [ ] `src/lib/stores/operations/operations.test.ts`
- [ ] `src/lib/stores/operations/operations.cut-direction.test.ts`
- [ ] `src/lib/stores/operations/operations.cut-direction-ui-changes.test.ts`
- [ ] `src/lib/utils/persistence-integration.test.ts`
- [ ] `src/lib/utils/complete-persistence.test.ts`
- [ ] `src/lib/utils/lead-persistence-utils.test.ts`
- [ ] `src/lib/stores/storage/store.test.ts`

### Test Content Updates

- [ ] `describe('Path...')` → `describe('Cut...')`
- [ ] `it('should ... path ...')` → `it('should ... cut ...')`
- [ ] Test variable names (`testPath` → `testCut`, etc.)
- [ ] Mock data object properties
- [ ] Assertion messages

---

## Phase 9: Documentation Updates

### `CLAUDE.md`

- [ ] Section title: "Operations and Paths" → "Operations and Cuts"
- [ ] "**Paths** are generated FROM operations" → "**Cuts** are generated FROM operations"
- [ ] "One path per chain for chain operations" → "One cut per chain for chain operations"
- [ ] "Multiple paths for part operations (shell + holes)" → "Multiple cuts for part operations (shell + holes)"
- [ ] "Displayed with green highlighting on canvas" (keep)
- [ ] "Selected paths shown in dark green" → "Selected cuts shown in dark green"

### Code Comments

- [ ] "Path Store" → "Cut Store" (in headers)
- [ ] "path geometry" → "cut geometry"
- [ ] "path data" → "cut data"
- [ ] "offset paths" → "offset cuts"
- [ ] "path rendering" → "cut rendering"
- [ ] Function documentation in all updated files

---

## Phase 10: Storage and Persistence

### `src/lib/stores/storage/interfaces.ts`

- [ ] `PathsState` → `CutsState` in persistence interfaces

### `src/lib/stores/storage/store.ts`

- [ ] Update Path/Cut references in storage logic
- [ ] Update localStorage keys if needed

### `src/lib/utils/lead-persistence-utils.ts`

- [ ] Parameter types: `path: Path` → `cut: Cut`
- [ ] All function signatures and JSDoc

---

## Exclusions - DO NOT RENAME

These should remain unchanged:

### Keep As-Is

- ✓ `CutPath` interface (already correctly named for toolpaths)
- ✓ `CutSequence` interface
- ✓ File path variables (`file_path`, `filePath`)
- ✓ SVG path attributes (`path`, `d`, `pathData`)
- ✓ Shape path concepts (`shapePath`, `svgPath`)
- ✓ URL paths and route paths
- ✓ Geometry path utilities (unrelated to Path interface)
- ✓ All node_modules content
- ✓ All reference directory content
- ✓ `tests/e2e/` path references (file system paths)
- ✓ Generic "path" in comments not referring to Path interface

### Examples of What NOT to Change

```typescript
// Keep these:
const filePath = '/path/to/file';
const svgPath = shape.pathData;
await fetch(urlPath);
d="M 0 0 L 100 100"  // SVG path attribute

// Change these:
const path: Path = { ... };  // → const cut: Cut = { ... };
pathStore.addPath(path);     // → cutStore.addCut(cut);
```

---

## Execution Strategy

### Pre-Execution Checks

- [ ] Commit current state to git
- [ ] Create feature branch: `git checkout -b refactor/rename-path-to-cut`
- [ ] Verify all tests pass: `npm run test`
- [ ] Verify build works: `npm run build`

### Execution Order

**IMPORTANT**: After completing each phase, run validation and fix all errors before proceeding to the next phase:
```bash
npm run format:fix && npm run validate
```

Do not proceed to the next phase until all errors are resolved.

1. [ ] **Phase 1**: Rename directories and files (start here to avoid conflicts)
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

2. [ ] **Phase 2**: Update type definitions and interfaces
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

3. [ ] **Phase 3**: Update store implementation
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

4. [ ] **Phase 4**: Update function names
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

5. [ ] **Phase 5**: Update components
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

6. [ ] **Phase 6**: Update rendering system
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

7. [ ] **Phase 7**: Update all imports
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

8. [ ] **Phase 8**: Update tests
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

9. [ ] **Phase 9**: Update documentation
   - [ ] Run: `npm run format:fix && npm run validate`
   - [ ] Fix all errors before proceeding

10. [ ] **Phase 10**: Update storage/persistence
    - [ ] Run: `npm run format:fix && npm run validate`
    - [ ] Fix all errors before proceeding

### Post-Execution Validation

- [ ] Run final validation: `npm run format:fix && npm run validate`
- [ ] Verify all checks pass (no errors)
- [ ] Run TypeScript type checking: `npm run typecheck`
- [ ] Run all unit tests: `npm run test`
- [ ] Run e2e tests: `npm run test:e2e`
- [ ] Run build: `npm run build`
- [ ] Manual testing:
  - [ ] Import DXF file
  - [ ] Create operation
  - [ ] Verify cuts display in UI
  - [ ] Check cut selection/highlighting
  - [ ] Verify G-code export works
- [ ] Search for remaining "path" references: `grep -r "path" src/ | grep -v "CutPath" | grep -v "filePath"`
- [ ] Review git diff for unintended changes
- [ ] Create commit: `git commit -m "Refactor: Rename Path to Cut throughout codebase"`

---

## Progress Tracking

**Current Phase**: Not started

**Completed Phases**: 0/10

**Total Tasks**: ~200+

**Estimated Time**: 3-4 hours

---

## Notes

- This is a comprehensive refactoring affecting ~50+ files
- The rename improves code clarity and reduces confusion
- All existing functionality will be preserved
- Tests ensure correctness throughout the process
- The phased approach minimizes risk of breaking changes
