# Move Part Detection into Layer Class

## Architecture Change

Move part detection from global store to per-layer property, making parts a derived property of each layer's chains.

## Implementation Steps

- [ ] **Update Part Interface** (`src/lib/cam/part/interfaces.ts`)
  - [ ] Add `layerName: string` field to `Part` interface

- [ ] **Update `detectParts()`** (`src/lib/cam/part/part-detection.ts`)
  - [ ] Add optional `layerName?: string` parameter
  - [ ] Set `layerName` on generated Part objects

- [ ] **Update Layer Class** (`src/lib/cam/layer/classes.svelte.ts`)
  - [ ] Add `#parts` private reactive state property
  - [ ] Add `parts` getter that calls `detectParts()` on `this.chains`
  - [ ] Cache results in `#parts`
  - [ ] Include `layerName` in Part objects

- [ ] **Remove Part Detection from Auto-Preprocess** (`src/lib/preprocessing/auto-preprocess.ts`)
  - [ ] Remove `PreprocessingStep.DetectParts` case entirely
  - [ ] Parts now auto-generate when `layer.parts` is accessed

- [ ] **Update All Calling Code**
  - [ ] Find all references to `partStore.parts` or `get(partStore).parts`
  - [ ] Replace with `Object.values(drawing.layers).flatMap(layer => layer.parts)`
  - [ ] Update to use layer-based part access pattern

- [ ] **Remove PartStore.parts** (`src/lib/stores/parts/store.ts`)
  - [ ] Remove `parts` field from PartStore interface
  - [ ] Remove `setParts()` method (or adapt for warnings-only)
  - [ ] Keep selection/hover/highlight state (UI-only concerns)

- [ ] **Update All Tests**
  - [ ] Part detection tests: verify layer integration
  - [ ] Store tests: update to use Layer.parts
  - [ ] Integration tests: verify parts generate correctly
  - [ ] E2E tests: ensure UI still works

## Benefits

- Parts auto-generate from layer data (reactive)
- No manual preprocessing step needed
- Layer visibility naturally controls part visibility
- Clearer data ownership (Layer owns its parts)
- Simpler state management
