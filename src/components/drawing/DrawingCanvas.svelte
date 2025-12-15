<script lang="ts">
    import { onMount, onDestroy, untrack } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { planStore } from '$lib/stores/plan/store.svelte';
    import { operationsStore } from '$lib/stores/operations/store.svelte';
    import { overlayStore } from '$lib/stores/overlay/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import {
        generateChainEndpoints,
        generateShapePoints,
        getShapeChainId,
        getChainShapeIds,
    } from '$lib/stores/visualization/functions';
    import type { ShapeData } from '$lib/cam/shape/interfaces';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { SelectionMode } from '$lib/config/settings/enums';
    import { RenderingPipeline } from '$lib/rendering/canvas/pipeline';
    import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';
    import { getCanvasConfigForStage } from '$components/drawing/canvas-config';
    import type { Drawing } from '$lib/cam/drawing/classes.svelte';
    import type { Chain } from '$lib/cam/chain/classes.svelte';
    import type { Cut } from '$lib/cam/cut/classes.svelte';
    import type { KerfData } from '$lib/cam/kerf/interfaces';
    import type { Rapid } from '$lib/cam/rapid/interfaces';

    // Properties
    let {
        onChainClick = null,
        onPartClick = null,
        currentStage,
    }: {
        onChainClick?: ((chainId: string) => void) | null;
        onPartClick?: ((partId: string) => void) | null;
        currentStage: WorkflowStage;
    } = $props();

    // Renderers
    let renderingPipeline: RenderingPipeline = new RenderingPipeline();
    // Canvas Container
    let canvasContainer: HTMLElement;
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    // Renderable objects
    const drawing: Drawing | null = $derived(drawingStore.drawing);

    // Optimized: Only recalculate when drawing.layers actually changes
    const chains: Chain[] = $derived.by(() => {
        if (!drawing) return [];
        const layers = drawing.layers; // Track layers object
        return Object.values(layers).flatMap((layer) => layer.chains);
    });

    const cuts: Cut[] = $derived(planStore.plan.cuts);

    // Optimized: Only recalculate when drawing.layers actually changes
    const parts = $derived.by(() => {
        if (!drawing) return [];
        const layers = drawing.layers; // Track layers object
        return Object.values(layers).flatMap((layer) => layer.parts);
    });
    const rapids: Rapid[] = $derived(
        cuts.map((cut) => cut.rapidIn).filter((rapid) => rapid !== undefined)
    );

    // Zoom / Drag / Scale
    // Track previous mouse position for accurate delta calculation during dragging
    let previousDragPos: { x: number; y: number } | null = null;
    const zoomScale = $derived(drawingStore.scale);
    const panOffset = $derived(drawingStore.offset);
    const displayUnit = $derived(drawingStore.displayUnit);
    const layerVisibility = $derived(drawingStore.layerVisibility);

    // Selection
    const selectionMode: SelectionMode = $derived(
        settingsStore.settings.selectionMode
    );
    const selectedShapeIds = $derived(selectionStore.shapes.selected);
    const hoveredShapeId = $derived(selectionStore.shapes.hovered);
    const selectedOffsetShape = $derived(selectionStore.shapes.selectedOffset);
    const selectedChainIds = $derived(selectionStore.chains.selected);
    const highlightedChainId = $derived(selectionStore.chains.highlighted);
    const highlightedPartId = $derived(selectionStore.parts.highlighted);
    const hoveredPartId = $derived(selectionStore.parts.hovered);
    const selectedPartIds = $derived(selectionStore.parts.selected);
    const selectedCutIds = $derived(selectionStore.cuts.selected);
    const highlightedCutId = $derived(selectionStore.cuts.highlighted);
    const selectedLeadIds = $derived(selectionStore.leads.selected);
    const highlightedLeadId = $derived(selectionStore.leads.highlighted);
    const selectedKerfId = $derived(selectionStore.kerfs.selected);
    const highlightedKerfId = $derived(selectionStore.kerfs.highlighted);
    const selectedRapidIds = $derived(selectionStore.rapids.selected);
    const highlightedRapidId = $derived(selectionStore.rapids.highlighted);

    const cutsState = $derived({
        showCutNormals: visualizationStore.showCutNormals,
        showCutDirections: visualizationStore.showCutDirections,
        showCutPaths: visualizationStore.showCutPaths,
        showCutStartPoints: visualizationStore.showCutStartPoints,
        showCutEndPoints: visualizationStore.showCutEndPoints,
        showCutTangentLines: visualizationStore.showCutTangentLines,
    });
    const operations = $derived(operationsStore.operations);

    // Optimized: Single-pass filter with operation lookup map
    const chainsWithCuts = $derived.by(() => {
        if (!cuts || !operations) return [];

        // Build operation lookup map once
        const enabledOps = new Map(
            operations.filter((op) => op.enabled).map((op) => [op.id, op])
        );

        // Single pass filter+map
        const chainIds = new SvelteSet<string>();
        for (const cut of cuts) {
            if (cut.enabled && enabledOps.has(cut.sourceOperationId)) {
                chainIds.add(cut.sourceChainId);
            }
        }

        return Array.from(chainIds);
    });
    const tessellationState = $derived(visualizationStore);
    // Direct tracking of toolHead to trigger reactivity when it changes
    // Must bypass currentOverlay to avoid broken reactivity chain
    const currentToolHead = $derived(
        overlayStore.overlays[currentStage]?.toolHead
    );

    // Visibility
    const showRapids = $derived(visualizationStore.showRapids);
    const showRapidDirections = $derived(
        visualizationStore.showRapidDirections
    );
    const shapeVisualization = $derived(visualizationStore);
    const showShapePaths = $derived(shapeVisualization.showShapePaths);
    const showShapeStartPoints = $derived(
        shapeVisualization.showShapeStartPoints
    );
    const showShapeEndPoints = $derived(shapeVisualization.showShapeEndPoints);
    const showShapeNormals = $derived(shapeVisualization.showShapeNormals);
    const showShapeWindingDirection = $derived(
        shapeVisualization.showShapeWindingDirection
    );
    const showShapeTangentLines = $derived(
        shapeVisualization.showShapeTangentLines
    );
    const showShapeTessellation = $derived(
        shapeVisualization.showShapeTessellation
    );
    const showChainPaths = $derived(visualizationStore.showChainPaths);
    const showChainStartPoints = $derived(
        visualizationStore.showChainStartPoints
    );
    const showChainEndPoints = $derived(visualizationStore.showChainEndPoints);
    const showChainTangentLines = $derived(
        visualizationStore.showChainTangentLines
    );
    const showChainNormals = $derived(visualizationStore.showChainNormals);
    const showChainDirections = $derived(
        visualizationStore.showChainDirections
    );
    const showChainTessellation = $derived(
        visualizationStore.showChainTessellation
    );
    const showPartSurface = $derived(visualizationStore.showPartSurface);
    const showCutNormals = $derived(cutsState.showCutNormals);
    const showCutDirections = $derived(cutsState.showCutDirections);
    const showCutPaths = $derived(cutsState.showCutPaths);
    const showCutter = $derived(visualizationStore.showCutter);
    const showCutStartPoints = $derived(cutsState.showCutStartPoints);
    const showCutEndPoints = $derived(cutsState.showCutEndPoints);
    const showCutTangentLines = $derived(cutsState.showCutTangentLines);
    const showLeadNormals = $derived(visualizationStore.showLeadNormals);
    const showLeadPaths = $derived(visualizationStore.showLeadPaths);
    const showLeadKerfs = $derived(visualizationStore.showLeadKerfs);
    const kerfs: KerfData[] = $derived([]); // Kerf calculation currently disabled
    const showKerfPaths = $derived(visualizationStore.showKerfPaths);

    // Compute effective interaction mode based on selection mode and current stage
    const interactionMode = $derived.by(() => {
        // If selection mode is explicit (not auto), use it
        if (selectionMode === SelectionMode.Shape) {
            return 'shapes';
        } else if (selectionMode === SelectionMode.Chain) {
            return 'chains';
        } else if (selectionMode === SelectionMode.Part) {
            return 'chains'; // Parts use chain interaction
        } else if (selectionMode === SelectionMode.Cut) {
            return 'cuts';
        } else if (selectionMode === SelectionMode.Lead) {
            return 'leads';
        } else if (selectionMode === SelectionMode.Kerf) {
            return 'kerfs';
        } else if (selectionMode === SelectionMode.Rapid) {
            return 'rapids';
        } else {
            // Auto mode: use stage-based interaction
            switch (currentStage) {
                case WorkflowStage.PROGRAM:
                    return 'chains';
                case WorkflowStage.SIMULATE:
                    return 'cuts';
                default:
                    return 'shapes';
            }
        }
    });

    // Get unit scale factor from DrawingStore
    const unitScale = $derived(drawingStore.unitScale);

    // Get canvas configuration for current stage
    const canvasConfig = $derived(
        getCanvasConfigForStage(currentStage, {
            onChainClick,
            onPartClick,
        })
    );

    // GROUP 1: Core geometry data (drawing, shapes)
    $effect(() => {
        performance.mark('canvas-effect-group1-start');

        // Access shapes to create reactive dependency on layer shape arrays
        // When Layer.translate() reassigns its $state arrays, this will trigger
        const _shapes = drawing?.shapes;
        if (drawing) {
            renderingPipeline.updateState({
                drawing: drawing,
                selectionMode: selectionMode,
            });
        }

        performance.mark('canvas-effect-group1-end');
        performance.measure(
            'Canvas Effect Group 1',
            'canvas-effect-group1-start',
            'canvas-effect-group1-end'
        );
    });

    // GROUP 2: Derived collections (chains, parts, cuts, operations, rapids, kerfs)
    $effect(() => {
        performance.mark('canvas-effect-group2-start');

        if (
            chains ||
            parts ||
            cuts ||
            operations ||
            offsetCalculationHash ||
            rapids ||
            kerfs
        ) {
            renderingPipeline.updateState({
                chains: chains || [],
                parts: parts || [],
                cuts: cuts || [],
                cutsState: cutsState,
                operations: operations,
                chainsWithCuts: chainsWithCuts,
                rapids: rapids || [],
                kerfs: kerfs || [],
            });
        }

        performance.mark('canvas-effect-group2-end');
        performance.measure(
            'Canvas Effect Group 2',
            'canvas-effect-group2-start',
            'canvas-effect-group2-end'
        );
    });

    // Universal overlay update function for any stage
    function updateOverlaysForCurrentStage() {
        if (!currentStage) return;

        // Handle shape points
        if (drawing && drawing.shapes) {
            const allShapes = drawing.shapes;
            const allShapePoints = generateShapePoints(
                allShapes,
                new Set(allShapes.map((s) => s.id))
            );
            let filteredShapePoints: typeof allShapePoints = [];

            if (
                shapeVisualization.showShapeStartPoints ||
                shapeVisualization.showShapeEndPoints
            ) {
                filteredShapePoints = allShapePoints.filter((point) => {
                    if (
                        point.type === 'start' &&
                        shapeVisualization.showShapeStartPoints
                    ) {
                        return true;
                    }
                    if (
                        point.type === 'end' &&
                        shapeVisualization.showShapeEndPoints
                    ) {
                        return true;
                    }
                    return false;
                });
            }

            untrack(() =>
                overlayStore.setShapePoints(currentStage, filteredShapePoints)
            );
        } else {
            untrack(() => overlayStore.clearShapePoints(currentStage));
        }

        // Handle chain endpoints
        if (chains.length > 0) {
            const allEndpoints = generateChainEndpoints(chains);
            let filteredEndpoints: typeof allEndpoints = [];

            if (
                visualizationStore.showChainStartPoints ||
                visualizationStore.showChainEndPoints
            ) {
                filteredEndpoints = allEndpoints.filter(
                    (
                        endpoint: import('$lib/stores/overlay/interfaces').ChainEndpoint
                    ) => {
                        if (
                            endpoint.type === 'start' &&
                            visualizationStore.showChainStartPoints
                        ) {
                            return true;
                        }
                        if (
                            endpoint.type === 'end' &&
                            visualizationStore.showChainEndPoints
                        ) {
                            return true;
                        }
                        return false;
                    }
                );
            }

            untrack(() =>
                overlayStore.setChainEndpoints(currentStage, filteredEndpoints)
            );
        } else {
            untrack(() => overlayStore.clearChainEndpoints(currentStage));
        }
    }

    // Track offset calculation state changes
    const offsetCalculationHash = $derived(
        cuts && cuts.length > 0
            ? cuts
                  .map((cut) => ({
                      id: cut.id,
                      hasOffset: !!cut.offset,
                      offsetHash: cut.offset
                          ? JSON.stringify(
                                cut.offset.offsetShapes?.map(
                                    (s: ShapeData) => s.id
                                ) || []
                            )
                          : null,
                  }))
                  .join('|')
            : ''
    );

    // GROUP 3: Transform (pan, zoom, units)
    $effect(() => {
        performance.mark('canvas-effect-group3-start');

        if (
            zoomScale !== undefined &&
            panOffset !== undefined &&
            displayUnit !== undefined
        ) {
            // Use pipeline's single updateTransform method to ensure coordinator stays in sync
            renderingPipeline.updateTransform(zoomScale, panOffset, unitScale);
        }

        performance.mark('canvas-effect-group3-end');
        performance.measure(
            'Canvas Effect Group 3',
            'canvas-effect-group3-start',
            'canvas-effect-group3-end'
        );
    });

    // GROUP 4: Selection, hover, and visibility
    $effect(() => {
        performance.mark('canvas-effect-group4-start');

        if (renderingPipeline) {
            renderingPipeline.updateState({
                selection: {
                    selectedShapes: selectedShapeIds,
                    selectedChainIds,
                    highlightedChainId,
                    highlightedPartId,
                    selectedPartIds,
                    selectedCutIds: selectedCutIds,
                    highlightedCutId: highlightedCutId,
                    selectedRapidIds,
                    highlightedRapidId,
                    selectedLeadIds,
                    highlightedLeadId,
                    selectedKerfId,
                    highlightedKerfId,
                    selectedOffsetShape,
                    hoveredPartId,
                    hoveredShape: hoveredShapeId,
                },
                visibility: {
                    layerVisibility: layerVisibility || {},
                    showRapids,
                    showRapidDirections,
                    showCuts: true,
                    showChains: true,
                    showParts: true,
                    showPartSurface,
                    showOverlays: true,
                    showShapePaths,
                    showShapeStartPoints,
                    showShapeEndPoints,
                    showShapeNormals,
                    showShapeWindingDirection,
                    showShapeTangentLines,
                    showShapeTessellation,
                    showChainPaths,
                    showChainStartPoints,
                    showChainEndPoints,
                    showChainTangentLines,
                    showChainNormals,
                    showChainDirections,
                    showChainTessellation,
                    showCutNormals,
                    showCutDirections,
                    showCutPaths,
                    showCutter,
                    showCutStartPoints,
                    showCutEndPoints,
                    showCutTangentLines,
                    showLeadNormals: showLeadNormals,
                    showLeadPaths: showLeadPaths,
                    showLeadKerfs: showLeadKerfs,
                    showKerfPaths,
                },
                respectLayerVisibility: canvasConfig.respectLayerVisibility,
            });
        }

        performance.mark('canvas-effect-group4-end');
        performance.measure(
            'Canvas Effect Group 4',
            'canvas-effect-group4-start',
            'canvas-effect-group4-end'
        );
    });

    // GROUP 5a: Update rendering pipeline when overlays change
    $effect(() => {
        performance.mark('canvas-effect-group5a-start');

        // Track these explicitly to trigger when they change
        const stage = currentStage;
        const _toolHead = currentToolHead;
        const _tessState = tessellationState;

        // Read overlay OUTSIDE untrack so toolHead changes propagate to renderer
        if (stage !== undefined) {
            const overlay = overlayStore.overlays[stage];
            renderingPipeline.updateState({
                overlays: overlayStore.overlays,
                currentOverlay: overlay,
                stage: stage,
            });
        }

        performance.mark('canvas-effect-group5a-end');
        performance.measure(
            'Canvas Effect Group 5a',
            'canvas-effect-group5a-start',
            'canvas-effect-group5a-end'
        );
    });

    // GROUP 5b: Generate overlays when visualization settings or geometry changes
    // This effect only runs for shape/chain overlays, NOT toolHead
    $effect(() => {
        performance.mark('canvas-effect-group5b-start');

        // Only track inputs that should trigger overlay regeneration
        // Don't track currentStage to avoid running when just switching stages
        const shouldGenerate =
            drawing?.shapes &&
            (shapeVisualization.showShapeStartPoints ||
                shapeVisualization.showShapeEndPoints ||
                visualizationStore.showChainStartPoints ||
                visualizationStore.showChainEndPoints);

        if (shouldGenerate && currentStage) {
            // Use untrack to prevent reading overlays during generation
            untrack(() => updateOverlaysForCurrentStage());
        }

        performance.mark('canvas-effect-group5b-end');
        performance.measure(
            'Canvas Effect Group 5b',
            'canvas-effect-group5b-start',
            'canvas-effect-group5b-end'
        );
    });

    // Set up RenderingPipeline
    onMount(() => {
        // Get container dimensions
        const rect = canvasContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Update drawing store with canvas dimensions
        drawingStore.setContainerDimensions(width, height);

        // Initialize rendering pipeline with multi-canvas support
        renderingPipeline.initialize(canvasContainer, width, height, {
            zoomScale,
            panOffset,
            unitScale,
        });

        // Set up interaction callbacks instead of direct event listeners
        renderingPipeline.setInteractionCallbacks({
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
            onWheel: handleWheel,
            onContextMenu: handleContextMenu,
        });
    });

    // Tear down RenderingPipeline
    onDestroy(() => {
        if (hoverTimeout !== null) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        // Clean up rendering pipeline
        renderingPipeline.destroy();
    });

    //
    // Event handlers
    //

    function handleMouseDown(e: MouseEvent) {
        const interactionState = renderingPipeline.getInteractionState();
        if (!interactionState) return;

        // Use the actual event position for accurate hit testing
        const screenClickPos = { x: e.offsetX, y: e.offsetY };

        // Initialize drag tracking for panning
        if (e.button === 1 || e.button === 2) {
            previousDragPos = { x: e.offsetX, y: e.offsetY };
        }

        // Only handle shape selection with left mouse button
        if (e.button === 0) {
            // Use unified hit detection from rendering pipeline with actual click position
            const hitResult = renderingPipeline.hitScreen(screenClickPos);
            let shape = null;

            if (hitResult) {
                switch (hitResult.type) {
                    case HitTestType.RAPID:
                        // Handle rapid selection (allow in chains, rapids, and cuts modes)
                        if (
                            interactionMode === 'rapids' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            selectionStore.toggleRapidSelection(hitResult.id);
                            return; // Don't process other selections
                        }
                        break;

                    case HitTestType.SHAPE:
                        const metadata = hitResult.metadata;
                        shape = metadata?.shape;
                        break;

                    case HitTestType.CHAIN:
                        // Handle chain selection directly
                        if (interactionMode === 'chains' && onChainClick) {
                            const chainId = hitResult.id;

                            // Get all shapes in the chain
                            const chainShapeIds =
                                chains
                                    .find((c) => c.id === chainId)
                                    ?.shapes.map((s) => s.id) || [];

                            // Check if this chain is already selected
                            const chainAlreadySelected =
                                selectedChainIds.has(chainId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle chain selection
                                if (chainAlreadySelected) {
                                    selectionStore.deselectChain(chainId);
                                    // Deselect shapes in this chain
                                    chainShapeIds.forEach((id: string) => {
                                        selectionStore.deselectShape(id);
                                    });
                                } else {
                                    selectionStore.selectChain(chainId, true);
                                    // Select shapes in this chain
                                    chainShapeIds.forEach((id: string) => {
                                        selectionStore.selectShape(id, true);
                                    });
                                }
                            } else {
                                // Single select mode: clear others and select this one
                                selectionStore.clearShapeSelection();
                                selectionStore.selectChain(chainId, false);
                                // Select all shapes in the chain
                                chainShapeIds.forEach((id: string) => {
                                    selectionStore.selectShape(id, true);
                                });
                            }

                            // Call the callback
                            onChainClick(chainId);
                            return;
                        }
                        break;

                    case HitTestType.PART:
                        // Handle part selection in Program stage
                        if (interactionMode === 'chains' && onPartClick) {
                            const partId = hitResult.id;
                            const partAlreadySelected =
                                selectedPartIds.has(partId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle part selection
                                if (partAlreadySelected) {
                                    selectionStore.deselectPart(partId);
                                } else {
                                    selectionStore.selectPart(partId, true);
                                }
                            } else {
                                // Single select mode: clear others and select this one
                                if (!partAlreadySelected) {
                                    selectionStore.clearShapeSelection();
                                    selectionStore.selectPart(partId, false);
                                }
                            }

                            // Call the external callback
                            onPartClick(partId);
                            return;
                        }
                        break;

                    case HitTestType.CUT:
                        // Handle cut endpoint selection
                        if (interactionMode === 'cuts') {
                            const cutId = hitResult.id;
                            const cutAlreadySelected =
                                selectedCutIds.has(cutId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle cut selection
                                selectionStore.toggleCutSelection(cutId);
                            } else {
                                // Single select mode
                                if (cutAlreadySelected) {
                                    selectionStore.selectCut(null); // Deselect if already selected
                                } else {
                                    selectionStore.selectCut(cutId, false); // Clear others and select this one
                                }
                            }
                            return;
                        }
                        break;

                    case HitTestType.LEAD:
                        // Handle lead selection (allow in chains, leads, and cuts modes)
                        if (
                            interactionMode === 'leads' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            const leadId = hitResult.id;
                            const leadAlreadySelected =
                                selectedLeadIds.has(leadId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle lead selection
                                selectionStore.toggleLeadSelection(leadId);
                            } else {
                                // Single select mode
                                if (leadAlreadySelected) {
                                    selectionStore.selectLead(null); // Deselect if already selected
                                } else {
                                    selectionStore.selectLead(leadId, false); // Clear others and select this one
                                }
                            }
                            return;
                        }
                        break;

                    case HitTestType.KERF:
                        // Handle kerf selection
                        if (interactionMode === 'kerfs') {
                            const kerfId = hitResult.id;
                            // Clear other selections
                            selectionStore.selectCut(null);
                            selectionStore.selectLead(null);
                            selectionStore.selectChain(null);
                            selectionStore.selectPart(null);
                            selectionStore.clearShapeSelection();
                            // Toggle kerf selection
                            if (selectedKerfId === kerfId) {
                                selectionStore.selectKerf(null); // Deselect if already selected
                            } else {
                                selectionStore.selectKerf(kerfId);
                            }
                            return;
                        }
                        break;
                }
            } else {
                // Clear selections when clicking on empty area
                if (
                    interactionMode === 'chains' &&
                    currentStage === 'program'
                ) {
                    selectionStore.clearOffsetShapeSelection();
                }
                shape = null;
            }

            if (shape) {
                if (interactionMode === 'shapes') {
                    // Edit mode - allow individual shape selection
                    if (!e.ctrlKey && !selectedShapeIds.has(shape.id)) {
                        selectionStore.clearShapeSelection();
                    }
                    selectionStore.selectShape(shape, e.ctrlKey);
                } else if (interactionMode === 'chains') {
                    // Program mode - allow chain and part selection
                    const chainId = getShapeChainId(shape.id, chains);
                    if (chainId) {
                        // When clicking on a shape outline, always prefer chain selection
                        if (onChainClick) {
                            // Handle chain click
                            // Get all shapes in the chain
                            const chainShapeIds = getChainShapeIds(
                                shape.id,
                                chains
                            );

                            // Check if this chain is already selected
                            const chainAlreadySelected =
                                selectedChainIds.has(chainId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle chain selection
                                if (chainAlreadySelected) {
                                    selectionStore.deselectChain(chainId);
                                    // Deselect shapes in this chain
                                    chainShapeIds.forEach((id) => {
                                        selectionStore.deselectShape(id);
                                    });
                                } else {
                                    selectionStore.selectChain(chainId, true);
                                    // Select shapes in this chain
                                    chainShapeIds.forEach((id) => {
                                        selectionStore.selectShape(id, true);
                                    });
                                }
                            } else {
                                // Single select mode: clear others and select this one
                                selectionStore.clearShapeSelection();
                                selectionStore.selectChain(chainId, false);
                                // Select all shapes in the chain
                                chainShapeIds.forEach((id) => {
                                    selectionStore.selectShape(id, true);
                                });
                            }

                            onChainClick(chainId);
                        }
                    }
                } else if (interactionMode === 'cuts') {
                    // Simulation mode - only allow cut/rapid selection
                    const chainId = getShapeChainId(shape.id, chains);

                    // Check if this chain has a cut and handle cut selection
                    if (chainId && chainsWithCuts.includes(chainId)) {
                        // Find the cut for this chain
                        const cutForChain = cuts.find(
                            (c) => c.sourceChainId === chainId
                        );
                        if (cutForChain) {
                            // Handle cut selection - don't select individual shapes
                            const cutAlreadySelected = selectedCutIds.has(
                                cutForChain.id
                            );

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle cut selection
                                selectionStore.toggleCutSelection(
                                    cutForChain.id
                                );
                            } else {
                                // Single select mode
                                if (cutAlreadySelected) {
                                    selectionStore.selectCut(null); // Deselect if already selected
                                } else {
                                    selectionStore.selectCut(
                                        cutForChain.id,
                                        false
                                    ); // Clear others and select this one
                                }
                            }
                        }
                    }
                    // Don't select individual shapes in cuts mode
                }
            } else {
                // Clicked in empty space - check for part selection in Program stage
                if (interactionMode === 'chains' && onPartClick) {
                    // Part hit detection is already handled above in unified hit detection
                    // If we reach here, no part was hit
                }

                if (!e.ctrlKey) {
                    // Clear all selections when clicking in empty space
                    selectionStore.clearShapeSelection();
                    selectionStore.clearChainSelection();
                    selectionStore.clearPartHighlight();
                    selectionStore.selectPart(null);
                    selectionStore.selectCut(null);
                    selectionStore.clearCutHighlight();
                    selectionStore.clearRapidSelection();
                    selectionStore.clearRapidHighlight();
                    selectionStore.selectLead(null);
                    selectionStore.clearLeadHighlight();
                }
            }
        }
    }

    function handleMouseMove(e: MouseEvent) {
        const interactionState = renderingPipeline.getInteractionState();
        if (!interactionState) return;

        const { isMouseDown, dragStart, mouseButton } = interactionState;
        const newMousePos = { x: e.offsetX, y: e.offsetY };

        if (isMouseDown && dragStart) {
            if (mouseButton === 1 || mouseButton === 2) {
                // Pan view with middle or right mouse button
                // Use the tracked previous position for accurate delta calculation
                if (previousDragPos) {
                    const delta = {
                        x: newMousePos.x - previousDragPos.x,
                        y: newMousePos.y - previousDragPos.y,
                    };

                    const newPanOffset = {
                        x: panOffset.x + delta.x,
                        y: panOffset.y + delta.y,
                    };

                    drawingStore.setViewTransform(zoomScale, newPanOffset);

                    // Update previous position for next move event
                    previousDragPos = { x: newMousePos.x, y: newMousePos.y };
                }
            }
        } else {
            // Throttle hover detection to improve performance
            if (hoverTimeout !== null) {
                clearTimeout(hoverTimeout);
            }

            hoverTimeout = setTimeout(() => {
                // Handle hover detection when not dragging
                const hitResult = renderingPipeline.hitScreen(newMousePos);

                let hoveredShapeId = null;
                let hoveredChainId: string | null = null;
                let hoveredPartId: string | null = null;
                let hoveredCutId: string | null = null;
                let hoveredRapidId: string | null = null;
                let hoveredLeadId: string | null = null;
                let hoveredKerfId: string | null = null;

                if (hitResult) {
                    if (hitResult.type === HitTestType.CHAIN) {
                        // Direct chain hit - only allow if in chains mode
                        if (interactionMode === 'chains') {
                            hoveredChainId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.PART) {
                        // Direct part hit - only allow if in chains mode (parts use chain interaction)
                        if (interactionMode === 'chains') {
                            hoveredPartId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.CUT) {
                        // Direct cut hit - only allow if in cuts mode
                        if (interactionMode === 'cuts') {
                            hoveredCutId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.RAPID) {
                        // Direct rapid hit - allow in chains, rapids, and cuts modes
                        if (
                            interactionMode === 'rapids' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            hoveredRapidId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.LEAD) {
                        // Direct lead hit - allow in chains, leads, and cuts modes
                        if (
                            interactionMode === 'leads' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            hoveredLeadId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.KERF) {
                        // Direct kerf hit - only allow if in kerfs mode
                        if (interactionMode === 'kerfs') {
                            hoveredKerfId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.SHAPE) {
                        const metadata = hitResult.metadata;
                        const shape = metadata?.shape;
                        if (shape) {
                            // Filter hover based on selection mode
                            const allowHover =
                                selectionMode === 'auto' ||
                                selectionMode === 'shape';
                            if (allowHover) {
                                if (interactionMode === 'shapes') {
                                    // Edit mode - show hover for individual shapes
                                    hoveredShapeId = shape.id;
                                } else if (interactionMode === 'chains') {
                                    // Program mode - show hover for chains
                                    hoveredShapeId = shape.id;
                                    // Also highlight the chain this shape belongs to
                                    hoveredChainId = getShapeChainId(
                                        shape.id,
                                        chains
                                    );
                                } else if (interactionMode === 'cuts') {
                                    // Simulation mode - only hover shapes that are part of selectable cuts
                                    const chainId = getShapeChainId(
                                        shape.id,
                                        chains
                                    );
                                    if (
                                        chainId &&
                                        chainsWithCuts.includes(chainId)
                                    ) {
                                        hoveredShapeId = shape.id;
                                    }
                                }
                            }
                        }
                    }
                }

                selectionStore.setHoveredShape(hoveredShapeId);

                // Update chain highlight
                if (hoveredChainId !== highlightedChainId) {
                    selectionStore.highlightChain(hoveredChainId);
                }

                // Update part hover/highlight
                if (hoveredPartId !== selectionStore.parts.hovered) {
                    selectionStore.hoverPart(hoveredPartId);
                }

                // Update cut highlight
                if (hoveredCutId !== highlightedCutId) {
                    selectionStore.highlightCut(hoveredCutId);
                }

                // Update rapid highlight
                if (hoveredRapidId !== highlightedRapidId) {
                    selectionStore.highlightRapid(hoveredRapidId);
                }

                // Update lead highlight
                if (hoveredLeadId !== highlightedLeadId) {
                    selectionStore.highlightLead(hoveredLeadId);
                }

                // Update kerf highlight
                if (hoveredKerfId !== highlightedKerfId) {
                    selectionStore.highlightKerf(hoveredKerfId);
                }

                hoverTimeout = null;
            }, 16); // ~60fps throttling (16ms)
        }
    }

    function handleMouseUp() {
        // InteractionManager handles the state, no need to manage it here
        // Clear drag tracking
        previousDragPos = null;
    }

    function handleWheel(e: globalThis.WheelEvent) {
        e.preventDefault();

        // Use the actual wheel event position for zoom center
        const zoomPoint = { x: e.offsetX, y: e.offsetY };

        // Calculate new scale in 5% increments
        const currentPercent = Math.round(zoomScale * 100);
        const increment = e.deltaY > 0 ? -5 : 5;
        const newPercent = Math.max(5, currentPercent + increment); // Minimum 5% zoom
        const newZoomScale = newPercent / 100;

        // Get fresh coordinator from pipeline (it's updated by $effect)
        const currentCoordinator = renderingPipeline.getCoordinator();
        if (!currentCoordinator) return;

        // Zoom towards mouse position using coordinate transformer
        const newPanOffset = currentCoordinator.calculateZoomOffset(
            zoomPoint,
            zoomScale,
            newZoomScale
        );

        drawingStore.setViewTransform(newZoomScale, newPanOffset);
    }

    function handleContextMenu(e: MouseEvent) {
        // Prevent browser context menu when right-clicking for drag operations
        e.preventDefault();
    }
</script>

<div
    bind:this={canvasContainer}
    class="canvas-container"
    role="img"
    aria-label="Drawing Canvas - Interactive CAD Drawing View"
></div>

<style>
    .canvas-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        cursor: crosshair;
        outline: none;
    }

    .canvas-container:active {
        cursor: move;
    }

    /* Multi-layer canvas styling - handled by Layer class */
    :global(.canvas-container canvas) {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none; /* Only interaction layer should receive events */
    }

    /* Allow pointer events only on interaction layer */
    :global(.canvas-container canvas[data-layer-id='interaction']) {
        pointer-events: auto;
        outline: none; /* Remove focus outline since layer is transparent */
    }
</style>
