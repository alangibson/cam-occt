Based on analysis of the codebase, here are all the expensive methods/functions
that run when this.drawing = drawing triggers the 11.7-second reactive update:

---

2. Canvas Rendering Effects (5 effects in DrawingCanvas.svelte)

Location: /src/components/drawing/DrawingCanvas.svelte:223-515

Effect Group 1: Core Geometry (line 223)

$effect(() => {
const \_shapes = drawing?.shapes; // ← Triggers on drawing change
if (drawing) {
renderingPipeline.updateState({
drawing: drawing,
selectionMode: selectionMode,
});
}
});

What drawing.shapes getter does: /src/lib/cam/drawing/classes.svelte.ts:28-32

- Calls Object.values(this.layers).flatMap(layer => layer.shapes)
- Flattens 101 Shape objects from all layers

What renderingPipeline.updateState() does:

- Updates internal state
- Triggers re-render of all shape renderers (101 shapes)
- Recalculates renderer visibility

Effect Group 2: Derived Collections (line 245)

$effect(() => {
if (chains || parts || cuts || operations || ...) {
renderingPipeline.updateState({
chains: chains || [],
parts: parts || [],
cuts: cuts || [],
// ... more updates
});
}
});

What this does:

- Reads from multiple $derived values that depend on drawing
- Updates rendering pipeline with new collections
- Triggers renderer updates for chains, parts, cuts

Effect Groups 3, 4, 5a, 5b: Transform, Selection, Overlays

- Group 3: Updates zoom/pan transform
- Group 4: Updates selection state (reads from many stores)
- Group 5a: Updates overlay renderers
- Group 5b: Regenerates shape/chain overlays when visualization settings change

Cost: Canvas has 101 shape renderers that must be updated/initialized when
drawing changes.

---

3. Derived Value Recalculations (Multiple components)

When drawing changes, ALL $derived values depending on it recalculate:

DrawingCanvas.svelte (lines 54-133)

const drawing = $derived(drawingStore.drawing);

const chains = $derived.by(() => {
if (!drawing) return [];
const layers = drawing.layers;
return Object.values(layers).flatMap(layer => layer.chains);
});

const parts = $derived.by(() => {
if (!drawing) return [];
const layers = drawing.layers;
return Object.values(layers).flatMap(layer => layer.parts);
});

const chainsWithCuts = $derived.by(() => {
// Filters chains that have cuts
// Builds enabledOps Map
// Single-pass filter
const chainIds = new SvelteSet<string>();
for (const cut of cuts) {
if (cut.enabled && enabledOps.has(cut.sourceOperationId)) {
chainIds.add(cut.sourceChainId);
}
}
return Array.from(chainIds);
});

Cost: Each $derived.by creates a new computation graph. Chains/parts
derivations call flatMap on all layers.

ProgramStage.svelte (lines 42-50)

const drawing = $derived(drawingStore.drawing);

const chains = $derived(
drawing
? Object.values(drawing.layers).flatMap(layer => layer.chains)
: []
);

const parts = $derived(
drawing
? Object.values(drawing.layers).flatMap(layer => layer.parts)
: []
);

Cost: More flatMap operations on layers.

LayersList.svelte, ChainProperties.svelte, ShapeProperties.svelte,
LayerProperties.svelte, GCodeExport.svelte, Footer.svelte

All have $derived values watching drawingStore.drawing that recalculate.

---

4. ProgramStage Cut Optimization Effect (AFTER cascade)

Location: /src/components/pages/program/ProgramStage.svelte:75-121

This effect runs AFTER the 11.7s cascade completes, but is triggered by the
cascade:

$effect(() => {
      // Creates hash from ALL cuts (lines 80-87)
      const cutsHash = cuts
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(c => `${c.id}:${c.normalConnectionPoint?.x}:...`) // HUGE string
.join('|');

      const optimizationHash =

`${cutsHash}|cutHolesFirst:${optimizationSettings.cutHolesFirst}`;

      if (optimizationHash !== previousPathsHash && cuts.length > 0 && ...) {
          setTimeout(() => {
              handleOptimizeCutOrder();  // ← EXPENSIVE
          }, 0);
      }

});

What handleOptimizeCutOrder() does:
/src/components/pages/program/ProgramStage.svelte:137-224

1. Creates chain map (line 149-152):
   const chainMap = new Map<string, Chain>();
   chains.forEach(chain => {
   chainMap.set(chain.id, new Chain(chain));
   });
   - Instantiates new Chain objects for all chains

2. Calls optimizeCutOrder() or generateRapidsFromCutOrder() (lines 164-190):
   - /src/lib/algorithms/optimize-cut-order/optimize-cut-order.ts
   - Traveling Salesman Problem (TSP) solver
   - Calculates optimal cut order to minimize rapid movements
   - Pre-calculates all cut start/end points
   - Caches lead geometry calculations
   - O(N²) complexity for N cuts (nearest neighbor algorithm)

3. Updates all cuts (lines 195-201):
   const orderedCutsWithUpdatedOrder = result.orderedCuts.map(
   (cut, index) => ({
   ...cut.toData(),
   order: index + 1,
   })
   );
   planStore.updateCuts(orderedCutsWithUpdatedOrder);
   - Serializes all cuts
   - Updates plan store (triggers more reactive updates)

Cost: This runs twice (300ms each = 600ms total) according to the performance
trace. The TSP algorithm is computationally expensive for large cut counts.

---

5. Drawing.layers Getter (Lazy initialization)

Location: /src/lib/cam/drawing/classes.svelte.ts:50-92

When drawing.layers is first accessed, it builds the entire layer structure:

get layers(): Record<string, Layer> {
if (this.#layers) return this.#layers; // Cached

      const layersMap: Record<string, Layer> = {};
      const layerDataMap: Record<string, LayerData> = {};

      // Group 101 shapes by layer
      this.#data.shapes.forEach(shape => {
          const layerName = shape.layer && shape.layer.trim() !== ''
              ? shape.layer : '0';

          if (!layerDataMap[layerName]) {
              layerDataMap[layerName] = {
                  name: layerName,
                  shapes: [],
                  chains: [],
                  parts: [],
              };
          }
          layerDataMap[layerName].shapes.push(shape);
      });

      // Convert to Layer instances
      Object.entries(layerDataMap).forEach(([name, data]) => {
          layersMap[name] = new Layer(data);
      });

      this.#layers = layersMap;  // Cache
      return layersMap;

}

Cost: Iterates through all 101 shapes, groups by layer, creates Layer
instances. This happens the first time drawing.layers is accessed during the
cascade.

---

6. Drawing.toData() Serialization

Location: /src/lib/cam/drawing/classes.svelte.ts:97-103

Called by collectCurrentState() during auto-save:

toData(): DrawingData {
return {
shapes: this.shapes.map(shape => shape.toData()), // ← Iterates 101
shapes
units: this.#data.units,
fileName: this.fileName,
};
}

Which calls:

get shapes(): Shape[] {
const layers = this.layers; // ← May trigger layer initialization
return Object.values(layers).flatMap(layer => layer.shapes); // ← Flattens
all shapes
}

Cost: Accesses drawing.layers (triggers initialization), then flattens and maps
101 shapes.

---

Summary of Expensive Operations

| Operation | Location | Frequency |
Complexity | Cost |
|--------------------------|------------------------------|-----------|--------------------------------------|-----------|
| Auto-save effects | +page.svelte:35-104 | 6x | O(N) shapes + chains + parts + cuts | Very High |
| collectCurrentState() | store.ts:46-180 | 6x | Serializes entire app state | Very High |
| drawing.toData() | classes.svelte.ts:97-103 | 6x | Maps 101 shapes | High |
| Canvas Effect Group 1 | DrawingCanvas.svelte:223 | 1x | Updates 101 renderers | High |
| Canvas Effect Group 2 | DrawingCanvas.svelte:245 | 1x | Updates collections | Medium |
| Canvas Effects 3-5 | DrawingCanvas.svelte:376-515 | 3x | Updates transform/selection/overlays | Medium |
| $derived chains | Multiple components | ~10x | flatMap on layers | Medium |
| $derived parts | Multiple components | ~10x | flatMap on layers | Medium |
| $derived chainsWithCuts | DrawingCanvas.svelte:115 | 1x | Filter/map cuts | Medium |
| drawing.layers getter | classes.svelte.ts:50-92 | 1x | Groups 101 shapes into layers | Medium |
| handleOptimizeCutOrder() | ProgramStage.svelte:137 | 2x | TSP O(N²) algorithm | Very High |
| optimizeCutOrder() | optimize-cut-order.ts | 2x | Traveling salesman solver | Very High |
| planStore.updateCuts() | ProgramStage.svelte:201 | 2x | Updates all cuts, triggers cascade | Medium |

---

Root Causes

1. Six auto-save effects that all serialize entire application state whenever
   ANY tracked property changes
2. collectCurrentState() is called 6 times, each time:
   - Serializing 101 shapes
   - Building chains array from all layers
   - Building parts array from all layers
   - Serializing all operations and cuts

3. Multiple flatMap operations across many $derived values watching
   drawing.layers
4. Canvas rendering pipeline updates for 101 shape renderers
5. Cut order optimization running twice (600ms) after the cascade
6. Cascading reactive effects where each update triggers more updates

The 11.7 seconds is spent in Svelte's dequeue function processing this entire
cascade of reactive computations, with heavy allocation/deallocation causing 37
garbage collections.
