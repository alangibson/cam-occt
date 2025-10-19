<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { operationsStore } from '$lib/stores/operations/store';
    import { tessellationStore } from '$lib/stores/tessellation/store';
    import { overlayStore } from '$lib/stores/overlay/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import { shapeVisualizationStore } from '$lib/stores/shape/store';
    import {
        leadStore,
        selectLead,
        clearLeadHighlight,
    } from '$lib/stores/leads/store';
    import { settingsStore } from '$lib/stores/settings/store';
    import { generateChainEndpoints } from '$lib/stores/chains/functions';
    import { generateShapePoints } from '$lib/stores/shape/functions';
    import {
        selectRapid,
        clearRapidHighlight,
    } from '$lib/stores/rapids/functions';
    import {
        getShapeChainId,
        getChainShapeIds,
    } from '$lib/stores/chains/functions';
    import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
    import type { Shape } from '$lib/geometry/shape/interfaces';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { getPhysicalScaleFactor } from '$lib/config/units/units';
    import { RenderingPipeline } from '$lib/rendering/canvas/pipeline';
    import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';
    import { getCanvasConfigForStage } from '$lib/config/canvas-config';

    export let onChainClick: ((chainId: string) => void) | null = null; // Callback for chain clicks
    export let onPartClick: ((partId: string) => void) | null = null; // Callback for part clicks
    export let currentStage: WorkflowStage; // Current workflow stage for overlay rendering

    // Canvas elements are now managed by RenderingPipeline/LayerManager
    let coordinator: CoordinateTransformer;
    // Renderers
    let renderingPipeline: RenderingPipeline = new RenderingPipeline();
    // Canvas Container
    let canvasContainer: HTMLElement;
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    // Track previous mouse position for accurate delta calculation during dragging
    let previousDragPos: { x: number; y: number } | null = null;

    $: drawing = $drawingStore.drawing;
    $: selectedShapes = $drawingStore.selectedShapes;
    $: hoveredShape = $drawingStore.hoveredShape;
    $: selectedOffsetShape = $drawingStore.selectedOffsetShape;
    $: zoomScale = $drawingStore.scale;
    $: panOffset = $drawingStore.offset;
    $: displayUnit = $drawingStore.displayUnit;
    $: layerVisibility = $drawingStore.layerVisibility;
    $: chains = $chainStore.chains;
    $: selectedChainId = $chainStore.selectedChainId;
    $: highlightedChainId = $chainStore.highlightedChainId;
    $: parts = $partStore.parts;
    $: highlightedPartId = $partStore.highlightedPartId;
    $: hoveredPartId = $partStore.hoveredPartId;
    $: selectedPartId = $partStore.selectedPartId;
    $: cutsState = $cutStore;
    $: operations = $operationsStore;
    // Only show chains as having cuts if their associated operations are enabled
    $: chainsWithCuts =
        cutsState && operations
            ? [
                  ...new Set(
                      cutsState.cuts
                          .filter((cut) => {
                              // Find the operation for this cut
                              const operation = operations.find(
                                  (op) => op.id === cut.operationId
                              );
                              // Only include cut if operation exists and is enabled
                              return (
                                  operation && operation.enabled && cut.enabled
                              );
                          })
                          .map((c) => c.chainId)
                  ),
              ]
            : [];
    $: selectedCutId = cutsState?.selectedCutId;
    $: highlightedCutId = cutsState?.highlightedCutId;
    $: tessellationState = $tessellationStore;
    $: overlayState = $overlayStore;
    $: currentOverlay = overlayState.overlays[currentStage];
    $: rapids = $rapidStore.rapids;
    $: showRapids = $rapidStore.showRapids;
    $: showRapidDirections = $rapidStore.showRapidDirections;
    $: selectedRapidId = $rapidStore.selectedRapidId;
    $: highlightedRapidId = $rapidStore.highlightedRapidId;
    $: shapeVisualization = $shapeVisualizationStore;
    $: showShapePaths = shapeVisualization.showShapePaths;
    $: showShapeStartPoints = shapeVisualization.showShapeStartPoints;
    $: showShapeEndPoints = shapeVisualization.showShapeEndPoints;
    $: showShapeNormals = shapeVisualization.showShapeNormals;
    $: showShapeWindingDirection = shapeVisualization.showShapeWindingDirection;
    $: showShapeTangentLines = shapeVisualization.showShapeTangentLines;
    $: chainVisualization = $chainStore;
    $: showChainPaths = chainVisualization.showChainPaths;
    $: showChainStartPoints = chainVisualization.showChainStartPoints;
    $: showChainEndPoints = chainVisualization.showChainEndPoints;
    $: showChainTangentLines = chainVisualization.showChainTangentLines;
    $: showChainNormals = chainVisualization.showChainNormals;
    $: showChainDirections = chainVisualization.showChainDirections;
    $: showChainTessellation = chainVisualization.showChainTessellation;
    $: showCutNormals = cutsState.showCutNormals;
    $: showCutDirections = cutsState.showCutDirections;
    $: showCutPaths = cutsState.showCutPaths;
    $: showCutter = cutsState.showCutter;
    $: showCutStartPoints = cutsState.showCutStartPoints;
    $: showCutEndPoints = cutsState.showCutEndPoints;
    $: showCutTangentLines = cutsState.showCutTangentLines;
    $: leadState = $leadStore;
    $: selectedLeadId = leadState.selectedLeadId;
    $: highlightedLeadId = leadState.highlightedLeadId;
    $: leadNormals = leadState.showLeadNormals;
    $: leadPaths = leadState.showLeadPaths;
    $: selectionMode = $settingsStore.settings.selectionMode;

    // Compute effective interaction mode based on selection mode and current stage
    $: interactionMode = (() => {
        // If selection mode is explicit (not auto), use it
        if (selectionMode === 'shape') {
            return 'shapes';
        } else if (selectionMode === 'chain') {
            return 'chains';
        } else if (selectionMode === 'part') {
            return 'chains'; // Parts use chain interaction
        } else if (selectionMode === 'cut') {
            return 'cuts';
        } else if (selectionMode === 'lead') {
            return 'leads';
        } else {
            // Auto mode: use stage-based interaction
            switch (currentStage) {
                case WorkflowStage.PREPARE:
                case WorkflowStage.PROGRAM:
                    return 'chains';
                case WorkflowStage.SIMULATE:
                    return 'cuts';
                case WorkflowStage.EDIT:
                default:
                    return 'shapes';
            }
        }
    })();

    // Calculate unit scale factor for proper unit display
    $: unitScale = drawing
        ? getPhysicalScaleFactor(drawing.units, displayUnit)
        : 1;

    // Get canvas configuration for current stage
    $: canvasConfig = getCanvasConfigForStage(currentStage, {
        onChainClick,
        onPartClick,
    });

    // Universal overlay management - works for all stages
    $: {
        // This will trigger whenever any of these reactive values change
        const shouldUpdate =
            currentStage &&
            (shapeVisualization || chainVisualization || chains);
        if (shouldUpdate) {
            updateOverlaysForCurrentStage();
        }
    }

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

            overlayStore.setShapePoints(currentStage, filteredShapePoints);
        } else {
            overlayStore.clearShapePoints(currentStage);
        }

        // Handle chain endpoints
        if (chains.length > 0) {
            const allEndpoints = generateChainEndpoints(chains);
            let filteredEndpoints: typeof allEndpoints = [];

            if (
                chainVisualization.showChainStartPoints ||
                chainVisualization.showChainEndPoints
            ) {
                filteredEndpoints = allEndpoints.filter(
                    (
                        endpoint: import('$lib/stores/overlay/interfaces').ChainEndpoint
                    ) => {
                        if (
                            endpoint.type === 'start' &&
                            chainVisualization.showChainStartPoints
                        ) {
                            return true;
                        }
                        if (
                            endpoint.type === 'end' &&
                            chainVisualization.showChainEndPoints
                        ) {
                            return true;
                        }
                        return false;
                    }
                );
            }

            overlayStore.setChainEndpoints(currentStage, filteredEndpoints);
        } else {
            overlayStore.clearChainEndpoints(currentStage);
        }
    }

    // Update coordinate transformer when parameters change
    $: if (coordinator) {
        coordinator.updateTransform(zoomScale, panOffset, unitScale);
    }

    // Track offset calculation state changes
    $: offsetCalculationHash = cutsState?.cuts
        ? cutsState.cuts
              .map((cut) => ({
                  id: cut.id,
                  hasOffset: !!cut.offset,
                  offsetHash: cut.offset
                      ? JSON.stringify(
                            cut.offset.offsetShapes?.map((s: Shape) => s.id) ||
                                []
                        )
                      : null,
              }))
              .join('|')
        : '';

    // Geometry changes (shapes, drawing structure)
    $: if (drawing) {
        renderingPipeline.updateState({
            drawing: drawing,
            selectionMode: selectionMode,
        });
    }

    // Transform changes (pan, zoom, units)
    $: if (
        zoomScale !== undefined &&
        panOffset !== undefined &&
        displayUnit !== undefined
    ) {
        renderingPipeline.updateState({
            transform: {
                zoomScale: zoomScale,
                panOffset: panOffset,
                unitScale: unitScale,
                coordinator: coordinator,
            },
        });
    }

    // Selection, hover, and visibility changes
    // Reactive to all these values to trigger updates when any change
    $: if (renderingPipeline) {
        renderingPipeline.updateState({
            selection: {
                selectedShapes,
                selectedChainId,
                highlightedChainId,
                highlightedPartId,
                selectedPartId,
                selectedCutId: selectedCutId,
                highlightedCutId: highlightedCutId,
                selectedRapidId,
                highlightedRapidId,
                selectedLeadId,
                highlightedLeadId,
                selectedOffsetShape,
                hoveredPartId,
                hoveredShape,
            },
            visibility: {
                layerVisibility: layerVisibility || {},
                showRapids,
                showRapidDirections,
                showCuts: true,
                showChains: true,
                showParts: true,
                showOverlays: true,
                showShapePaths,
                showShapeStartPoints,
                showShapeEndPoints,
                showShapeNormals,
                showShapeWindingDirection,
                showShapeTangentLines,
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
                showLeadNormals: leadNormals,
                showLeadPaths: leadPaths,
            },
            respectLayerVisibility: canvasConfig.respectLayerVisibility,
        });
    }

    // Cut and operation changes
    $: if (cutsState || operations || offsetCalculationHash) {
        renderingPipeline.updateState({
            cuts: cutsState?.cuts || [],
            cutsState: cutsState,
            operations: operations,
            chainsWithCuts: chainsWithCuts,
        });
    }

    // Overlay and stage changes
    $: if (
        tessellationState !== undefined ||
        currentOverlay !== undefined ||
        currentStage !== undefined
    ) {
        renderingPipeline.updateState({
            overlays: overlayState?.overlays || {},
            currentOverlay: currentOverlay,
            stage: currentStage,
        });
    }

    // Chains and parts data changes
    $: if (chains || parts) {
        renderingPipeline.updateState({
            chains: chains || [],
            parts: parts || [],
        });
    }

    // Rapids data changes
    $: if (rapids !== undefined) {
        renderingPipeline.updateState({
            rapids: rapids || [],
        });
    }

    onMount(() => {
        // Get container dimensions
        const rect = canvasContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Update drawing store with canvas dimensions
        drawingStore.setCanvasDimensions(width, height);

        // Initialize rendering pipeline with multi-canvas support
        renderingPipeline.initialize(canvasContainer, width, height, {
            zoomScale,
            panOffset,
            unitScale,
        });

        // Get coordinate transformer from pipeline
        const newCoordinator = renderingPipeline.getCoordinator();
        if (newCoordinator) {
            coordinator = newCoordinator;
        }

        // Set up interaction callbacks instead of direct event listeners
        renderingPipeline.setInteractionCallbacks({
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
            onWheel: handleWheel,
            onKeyDown: handleKeyDown,
            onContextMenu: handleContextMenu,
        });
    });

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
                        // Handle rapid selection (only in cuts mode, not in leads mode)
                        if (interactionMode === 'cuts') {
                            if (selectedRapidId === hitResult.id) {
                                selectRapid(null); // Deselect if already selected
                            } else {
                                selectRapid(hitResult.id);
                            }
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

                            // Check if any shape in the chain is already selected
                            const chainSelected = chainShapeIds.some(
                                (id: string) => selectedShapes.has(id)
                            );

                            if (!e.ctrlKey && !chainSelected) {
                                drawingStore.clearSelection();
                            }

                            // Select/deselect all shapes in the chain
                            chainShapeIds.forEach((id: string) => {
                                if (!selectedShapes.has(id) || !e.ctrlKey) {
                                    drawingStore.selectShape(id, true); // Always multi-select for chains
                                }
                            });

                            // Store the selected chain ID
                            chainStore.selectChain(chainId);

                            // Call the callback
                            onChainClick(chainId);
                            return;
                        }
                        break;

                    case HitTestType.PART:
                        // Handle part selection in Program stage
                        if (interactionMode === 'chains' && onPartClick) {
                            // Clear individual shape selection to avoid styling conflicts
                            drawingStore.clearSelection();
                            // Select the part locally for highlighting
                            partStore.selectPart(hitResult.id);
                            // Call the external callback
                            onPartClick(hitResult.id);
                            return;
                        }
                        break;

                    case HitTestType.CUT:
                        // Handle cut endpoint selection
                        if (interactionMode === 'cuts') {
                            const cutId = hitResult.id;
                            // Toggle cut selection
                            if (selectedCutId === cutId) {
                                cutStore.selectCut(null); // Deselect if already selected
                            } else {
                                cutStore.selectCut(cutId);
                            }
                            return;
                        }
                        break;

                    case HitTestType.LEAD:
                        // Handle lead selection
                        if (
                            interactionMode === 'leads' ||
                            interactionMode === 'cuts'
                        ) {
                            const leadId = hitResult.id;
                            // Toggle lead selection
                            if (selectedLeadId === leadId) {
                                selectLead(null); // Deselect if already selected
                            } else {
                                selectLead(leadId);
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
                    drawingStore.clearOffsetShapeSelection();
                }
                shape = null;
            }

            if (shape) {
                if (interactionMode === 'shapes') {
                    // Edit mode - allow individual shape selection
                    if (!e.ctrlKey && !selectedShapes.has(shape.id)) {
                        drawingStore.clearSelection();
                    }
                    drawingStore.selectShape(shape, e.ctrlKey);
                } else if (interactionMode === 'chains') {
                    // Program mode - allow chain and part selection
                    const chainId = getShapeChainId(
                        shape.id,
                        chains,
                        cutsState.cuts
                    );
                    if (chainId) {
                        // When clicking on a shape outline, always prefer chain selection
                        if (onChainClick) {
                            // Handle chain click
                            // Get all shapes in the chain
                            const chainShapeIds = getChainShapeIds(
                                shape.id,
                                chains
                            );

                            // Check if any shape in the chain is already selected
                            const chainSelected = chainShapeIds.some((id) =>
                                selectedShapes.has(id)
                            );

                            if (!e.ctrlKey && !chainSelected) {
                                drawingStore.clearSelection();
                            }

                            // Select/deselect all shapes in the chain
                            chainShapeIds.forEach((id) => {
                                if (!selectedShapes.has(id) || !e.ctrlKey) {
                                    drawingStore.selectShape(id, true); // Always multi-select for chains
                                }
                            });

                            onChainClick(chainId);
                        }
                    }
                } else if (interactionMode === 'cuts') {
                    // Simulation mode - only allow cut/rapid selection
                    const chainId = getShapeChainId(
                        shape.id,
                        chains,
                        cutsState.cuts
                    );

                    // Check if this chain has a cut and handle cut selection
                    if (chainId && chainsWithCuts.includes(chainId)) {
                        // Find the cut for this chain
                        const cutForChain = cutsState.cuts.find(
                            (c) => c.chainId === chainId
                        );
                        if (cutForChain) {
                            // Handle cut selection - don't select individual shapes
                            if (selectedCutId === cutForChain.id) {
                                cutStore.selectCut(null); // Deselect if already selected
                            } else {
                                cutStore.selectCut(cutForChain.id);
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
                    drawingStore.clearSelection();
                    chainStore.clearChainSelection();
                    partStore.clearHighlight();
                    partStore.selectPart(null);
                    cutStore.selectCut(null);
                    cutStore.clearHighlight();
                    selectRapid(null);
                    clearRapidHighlight();
                    selectLead(null);
                    clearLeadHighlight();
                }
            }
        }
    }

    function handleMouseMove(e: MouseEvent) {
        const interactionState = renderingPipeline.getInteractionState();
        if (!interactionState) return;

        const { mousePos, isMouseDown, dragStart, mouseButton } =
            interactionState;
        const newMousePos = { x: e.offsetX, y: e.offsetY };

        if (isMouseDown && dragStart) {
            if (mouseButton === 0 && selectedShapes.size > 0) {
                // Move selected shapes with left mouse button
                const worldDelta = {
                    x: coordinator.screenToWorldDistance(
                        newMousePos.x - mousePos.x
                    ),
                    y: -coordinator.screenToWorldDistance(
                        newMousePos.y - mousePos.y
                    ),
                };

                drawingStore.moveShapes(Array.from(selectedShapes), worldDelta);
            } else if (mouseButton === 1 || mouseButton === 2) {
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

                if (hitResult && hitResult.type === HitTestType.SHAPE) {
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
                                // Program mode - show hover for chains (set to actual shape, rendering handles chain highlighting)
                                hoveredShapeId = shape.id;
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

                drawingStore.setHoveredShape(hoveredShapeId);
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

        const interactionState = renderingPipeline.getInteractionState();
        if (!interactionState) return;

        const { mousePos } = interactionState;

        // Calculate new scale in 5% increments
        const currentPercent = Math.round(zoomScale * 100);
        const increment = e.deltaY > 0 ? -5 : 5;
        const newPercent = Math.max(5, currentPercent + increment); // Minimum 5% zoom
        const newZoomScale = newPercent / 100;

        // Zoom towards mouse position using coordinate transformer
        const newPanOffset = coordinator.calculateZoomOffset(
            mousePos,
            zoomScale,
            newZoomScale
        );

        drawingStore.setViewTransform(newZoomScale, newPanOffset);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Delete' && selectedShapes.size > 0) {
            drawingStore.deleteSelected();
        }
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
