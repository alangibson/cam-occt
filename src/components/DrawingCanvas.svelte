<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { pathStore } from '$lib/stores/paths/store';
    import { operationsStore } from '$lib/stores/operations/store';
    import { tessellationStore } from '$lib/stores/tessellation/store';
    import { overlayStore } from '$lib/stores/overlay/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import {
        selectRapid,
        clearRapidHighlight,
    } from '$lib/stores/rapids/functions';
    import {
        getShapeChainId,
        getChainShapeIds,
    } from '$lib/stores/chains/functions';
    import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
    import { clearTessellationCache } from '$lib/rendering/tessellation-cache';
    import { type Shape } from '$lib/types';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { getPhysicalScaleFactor } from '$lib/utils/units';
    import { RenderingPipeline } from '$lib/rendering/canvas/pipeline';
    import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';

    export let onChainClick: ((chainId: string) => void) | null = null; // Callback for chain clicks
    export let onPartClick: ((partId: string) => void) | null = null; // Callback for part clicks
    export let disableDragging = false; // Default to false, true to disable dragging
    export let currentStage: WorkflowStage; // Current workflow stage for overlay rendering
    export let interactionMode: 'shapes' | 'chains' | 'paths' = 'shapes'; // What type of objects can be selected

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
    $: pathsState = $pathStore;
    $: operations = $operationsStore;
    // Only show chains as having paths if their associated operations are enabled
    $: chainsWithPaths =
        pathsState && operations
            ? [
                  ...new Set(
                      pathsState.paths
                          .filter((path) => {
                              // Find the operation for this path
                              const operation = operations.find(
                                  (op) => op.id === path.operationId
                              );
                              // Only include path if operation exists and is enabled
                              return (
                                  operation && operation.enabled && path.enabled
                              );
                          })
                          .map((p) => p.chainId)
                  ),
              ]
            : [];
    $: selectedPathId = pathsState?.selectedPathId;
    $: highlightedPathId = pathsState?.highlightedPathId;
    $: tessellationState = $tessellationStore;
    $: overlayState = $overlayStore;
    $: currentOverlay = overlayState.overlays[currentStage];
    $: rapids = $rapidStore.rapids;
    $: showRapids = $rapidStore.showRapids;
    $: selectedRapidId = $rapidStore.selectedRapidId;
    $: highlightedRapidId = $rapidStore.highlightedRapidId;
    $: showChainStartPoints = $prepareStageStore.showChainStartPoints;
    $: showChainEndPoints = $prepareStageStore.showChainEndPoints;
    $: showChainTangentLines = $prepareStageStore.showChainTangentLines;

    // Calculate unit scale factor for proper unit display
    $: unitScale = drawing
        ? getPhysicalScaleFactor(drawing.units, displayUnit)
        : 1;

    // Update coordinate transformer when parameters change
    $: if (coordinator) {
        coordinator.updateTransform(zoomScale, panOffset, unitScale);
    }

    // Track offset calculation state changes
    $: offsetCalculationHash = pathsState?.paths
        ? pathsState.paths
              .map((path) => ({
                  id: path.id,
                  hasOffset: !!path.offset,
                  offsetHash: path.offset
                      ? JSON.stringify(
                            path.offset.offsetShapes?.map((s: Shape) => s.id) ||
                                []
                        )
                      : null,
              }))
              .join('|')
        : '';

    // Geometry changes (shapes, drawing structure)
    $: if (drawing) {
        // Clear cache when geometry changes
        clearTessellationCache();
        renderingPipeline.updateState({
            drawing: drawing,
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
                selectedPathId,
                highlightedPathId,
                selectedRapidId,
                highlightedRapidId,
                selectedOffsetShape,
                hoveredPartId,
                hoveredShape,
            },
            visibility: {
                layerVisibility: layerVisibility || {},
                showRapids,
                showPaths: true,
                showChains: true,
                showParts: true,
                showOverlays: true,
                showChainStartPoints,
                showChainEndPoints,
                showChainTangentLines,
            },
        });
    }

    // Path and operation changes
    $: if (pathsState || operations || offsetCalculationHash) {
        renderingPipeline.updateState({
            paths: pathsState?.paths || [],
            pathsState: pathsState,
            operations: operations,
            chainsWithPaths: chainsWithPaths,
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
                        // Handle rapid selection
                        if (selectedRapidId === hitResult.id) {
                            selectRapid(null); // Deselect if already selected
                        } else {
                            selectRapid(hitResult.id);
                        }
                        return; // Don't process other selections

                    case HitTestType.OFFSET:
                        // Handle offset shape selection in Program stage
                        if (
                            interactionMode === 'chains' &&
                            currentStage === 'program'
                        ) {
                            const metadata = hitResult.metadata;
                            const offsetShape =
                                metadata?.shapeType === 'offset'
                                    ? metadata.shape
                                    : null;
                            if (offsetShape) {
                                drawingStore.selectOffsetShape(offsetShape);
                                return; // Don't process regular shape selection
                            }
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

                    case HitTestType.PATH:
                        // Handle path endpoint selection
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
                    drawingStore.selectShape(shape.id, e.ctrlKey);
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
                } else if (interactionMode === 'paths') {
                    // Simulation mode - only allow path/rapid selection
                    const chainId = getShapeChainId(shape.id, chains);

                    // Check if this chain has a path and handle path selection
                    if (chainId && chainsWithPaths.includes(chainId)) {
                        // Find the path for this chain
                        const pathForChain = pathsState.paths.find(
                            (p) => p.chainId === chainId
                        );
                        if (pathForChain) {
                            // Handle path selection - don't select individual shapes
                            if (selectedPathId === pathForChain.id) {
                                pathStore.selectPath(null); // Deselect if already selected
                            } else {
                                pathStore.selectPath(pathForChain.id);
                            }
                        }
                    }
                    // Don't select individual shapes in paths mode
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
                    pathStore.selectPath(null);
                    pathStore.clearHighlight();
                    selectRapid(null);
                    clearRapidHighlight();
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
            if (
                mouseButton === 0 &&
                selectedShapes.size > 0 &&
                !disableDragging
            ) {
                // Move selected shapes with left mouse button (only if dragging is enabled)
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
                        if (interactionMode === 'shapes') {
                            // Edit mode - show hover for individual shapes
                            hoveredShapeId = shape.id;
                        } else if (interactionMode === 'chains') {
                            // Program mode - show hover for chains (set to actual shape, rendering handles chain highlighting)
                            hoveredShapeId = shape.id;
                        } else if (interactionMode === 'paths') {
                            // Simulation mode - only hover shapes that are part of selectable paths
                            const chainId = getShapeChainId(shape.id, chains);
                            if (chainId && chainsWithPaths.includes(chainId)) {
                                hoveredShapeId = shape.id;
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
