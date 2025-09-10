<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { drawingStore } from '../lib/stores/drawing';
    import { chainStore } from '../lib/stores/chains';
    import { partStore } from '../lib/stores/parts';
    import { pathStore, type Path } from '../lib/stores/paths';
    import { operationsStore } from '../lib/stores/operations';
    import { tessellationStore } from '../lib/stores/tessellation';
    import { overlayStore } from '../lib/stores/overlay';
    import {
        rapidStore,
        selectRapid,
        clearRapidHighlight,
    } from '../lib/stores/rapids';
    import {
        getShapeChainId,
        getChainShapeIds,
        clearChainSelection,
    } from '../lib/stores/chains';
    import {
        getChainPartType,
        getPartChainIds,
        clearHighlight,
        selectPart,
    } from '../lib/stores/parts';
    import { clearPathHighlight } from '../lib/stores/paths';
    import { sampleNURBS, evaluateNURBS } from '../lib/geometry/nurbs';
    import {
        getShapeStartPoint,
        getShapeEndPoint,
        samplePathAtDistanceIntervals,
    } from '$lib/geometry';
    import { CoordinateTransformer } from '../lib/rendering/coordinate-transformer';
    import {
        SPLINE_TESSELLATION_TOLERANCE,
        ELLIPSE_TESSELLATION_POINTS,
    } from '../lib/constants';
    import { debounce } from '../lib/utils/state-persistence';
    import { tessellateEllipse } from '../lib/geometry/ellipse-tessellation';
    import { tessellateSpline } from '../lib/geometry/spline-tessellation';
    import {
        getCachedTessellation,
        clearTessellationCache,
    } from '../lib/rendering/tessellation-cache';
    import {
        getEllipseParameters,
        isFullEllipse,
        distanceFromEllipsePerimeter,
    } from '../lib/utils/ellipse-utils';
    import {
        RenderStateManager,
        PanStateManager,
    } from '../lib/rendering/render-state';
    import {
        calculateViewportBounds,
        cullShapesToViewport,
    } from '../lib/rendering/viewport-culling';
    import LeadVisualization from './LeadVisualization.svelte';
    import {
        type Shape,
        type Point2D,
        type Line,
        type Arc,
        type Circle,
        type Polyline,
        type Ellipse,
        type Spline,
        GeometryType,
    } from '../lib/types';
    import type { WorkflowStage } from '../lib/stores/workflow';
    import { getPhysicalScaleFactor, type Unit } from '../lib/utils/units';
    import { normalizeAngle } from '../lib/utils/polygon-geometry-shared';
    import { isPointInsidePart } from '../lib/algorithms/raytracing/point-in-chain';

    export let respectLayerVisibility = true; // Default to true for Edit stage
    export let treatChainsAsEntities = false; // Default to false, true for Program stage
    export let onChainClick: ((chainId: string) => void) | null = null; // Callback for chain clicks
    export let onPartClick: ((partId: string) => void) | null = null; // Callback for part clicks
    export let disableDragging = false; // Default to false, true to disable dragging
    export let currentStage: WorkflowStage; // Current workflow stage for overlay rendering
    export let interactionMode: 'shapes' | 'chains' | 'paths' = 'shapes'; // What type of objects can be selected

    /**
     * Physical spacing between cut direction chevrons in drawing units
     */
    const CHEVRON_SPACING_UNITS: number = 10;

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let mousePos: Point2D = { x: 0, y: 0 };
    let isMouseDown = false;
    let dragStart: Point2D | null = null;
    let mouseButton = 0; // Track which mouse button was pressed
    let coordinator: CoordinateTransformer;
    let leadVisualization: LeadVisualization;

    // Performance optimization managers
    let renderStateManager = new RenderStateManager();
    let panStateManager = new PanStateManager();

    $: drawing = $drawingStore.drawing;
    $: selectedShapes = $drawingStore.selectedShapes;
    $: hoveredShape = $drawingStore.hoveredShape;
    $: selectedOffsetShape = $drawingStore.selectedOffsetShape;
    $: scale = $drawingStore.scale;
    $: offset = $drawingStore.offset;
    $: layerVisibility = $drawingStore.layerVisibility;
    $: displayUnit = $drawingStore.displayUnit;
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

    // Get chain IDs that belong to the highlighted part
    $: highlightedChainIds = highlightedPartId
        ? getPartChainIds(highlightedPartId, parts)
        : [];

    // Get chain IDs that belong to the hovered part
    $: hoveredChainIds = hoveredPartId
        ? getPartChainIds(hoveredPartId, parts)
        : [];

    // Get chain IDs that belong to the selected part
    $: selectedChainIds = selectedPartId
        ? getPartChainIds(selectedPartId, parts)
        : [];

    // Calculate physical scale factor for proper unit display
    $: physicalScale = drawing
        ? getPhysicalScaleFactor(drawing.units, displayUnit)
        : 1;
    $: totalScale = scale * physicalScale;

    // Update coordinate transformer when parameters change
    $: if (canvas && coordinator) {
        coordinator.updateTransform(scale, offset, physicalScale);
    }

    // Create debounced render function for rapid offset recalculations
    const debouncedRender = debounce(() => {
        if (ctx) {
            render();
        }
    }, 16); // ~60fps for smooth updates

    // Track offset calculation state changes
    $: offsetCalculationHash = pathsState?.paths
        ? pathsState.paths
              .map((path) => ({
                  id: path.id,
                  hasOffset: !!path.calculatedOffset,
                  offsetHash: path.calculatedOffset
                      ? JSON.stringify(
                            path.calculatedOffset.offsetShapes?.map(
                                (s: Shape) => s.id
                            ) || []
                        )
                      : null,
              }))
              .join('|')
        : '';

    // Targeted reactive updates for performance optimization

    // Geometry changes (shapes, drawing structure)
    $: if (drawing) {
        renderStateManager.markDirty('geometry');
        clearTessellationCache(); // Clear cache when geometry changes
        requestOptimizedRender();
    }

    // Transform changes (pan, zoom, units)
    $: if (scale || offset || displayUnit) {
        renderStateManager.markDirty('transforms');
        requestOptimizedRender();
    }

    // Selection and hover changes
    $: if (
        selectedShapes ||
        hoveredShape ||
        selectedChainId ||
        highlightedChainId ||
        highlightedPartId ||
        hoveredPartId ||
        selectedPartId ||
        selectedPathId ||
        highlightedPathId
    ) {
        renderStateManager.markDirty('selection');
        requestOptimizedRender();
    }

    // Path and operation changes
    $: if (pathsState || operations || offsetCalculationHash) {
        renderStateManager.markDirty('paths');
        requestOptimizedRender();
    }

    // Overlay and stage changes
    $: if (tessellationState || currentOverlay) {
        renderStateManager.markDirty('overlays');
        requestOptimizedRender();
    }

    function requestOptimizedRender() {
        if (ctx) {
            renderStateManager.requestRender(() => render());
        }
    }

    // Separate debounced reactive block for rapid offset updates
    $: if (pathsState?.paths && ctx) {
        const hasActiveOffsetCalculations = pathsState.paths.some(
            (path) =>
                path.calculatedOffset &&
                path.calculatedOffset.offsetShapes &&
                path.calculatedOffset.offsetShapes.length > 0
        );

        // Use debounced rendering for complex offset scenarios
        if (hasActiveOffsetCalculations && pathsState.paths.length > 10) {
            debouncedRender();
        }
    }

    let canvasContainer: HTMLElement;
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    onMount(() => {
        ctx = canvas.getContext('2d')!;

        // Initialize coordinate transformer
        coordinator = new CoordinateTransformer(
            canvas,
            scale,
            offset,
            physicalScale
        );

        // Set up resize observer to maintain proper canvas sizing
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;

                // Store previous canvas dimensions to calculate offset adjustment
                const prevWidth = canvas.width;
                const prevHeight = canvas.height;

                // Update canvas size to match container
                canvas.width = width;
                canvas.height = height;

                // Update coordinate transformer canvas dimensions
                if (coordinator) {
                    coordinator.updateCanvas(canvas);
                }

                // No need to adjust offset anymore - origin position is now fixed

                // Re-render after resize
                if (ctx) {
                    render();
                }
            }
        });

        if (canvasContainer) {
            resizeObserver.observe(canvasContainer);
        }

        // Initial render
        render();

        return () => {
            resizeObserver.disconnect();
        };
    });

    onDestroy(() => {
        if (hoverTimeout !== null) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
    });

    function render() {
        if (!ctx || !drawing) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set transform using coordinate transformer
        ctx.save();
        const screenOrigin = coordinator.getScreenOrigin();
        ctx.translate(screenOrigin.x, screenOrigin.y);
        ctx.scale(coordinator.getTotalScale(), -coordinator.getTotalScale()); // Flip Y axis for CAD convention

        // Draw origin cross at (0,0)
        drawOriginCross();

        // Calculate viewport bounds for culling
        const viewportBounds = calculateViewportBounds(
            canvas.width,
            canvas.height,
            scale,
            offset,
            physicalScale
        );

        // Use viewport culling for large drawings
        const shouldCull = drawing.shapes.length > 100;
        const shapesToRender = shouldCull
            ? cullShapesToViewport(drawing.shapes, viewportBounds, 50)
                  .visibleShapes
            : drawing.shapes;

        // Draw visible shapes
        shapesToRender.forEach((shape) => {
            // Check if layer is visible (only if respectLayerVisibility is true)
            if (respectLayerVisibility) {
                const shapeLayer = shape.layer || '0';
                const isVisible = layerVisibility[shapeLayer] !== false; // Default to visible if not set

                if (!isVisible) return; // Skip invisible shapes
            }

            const chainId = getShapeChainId(shape.id, chains);
            const partType = getChainPartType(chainId || '', parts);
            let isSelected = selectedShapes.has(shape.id);
            let isHovered = hoveredShape === shape.id;

            // If treating chains as entities, check if any shape in the chain is selected/hovered
            if (treatChainsAsEntities && chainId) {
                const chainShapeIds = getChainShapeIds(shape.id, chains);
                isSelected = chainShapeIds.some((id) => selectedShapes.has(id));
                isHovered = chainShapeIds.some((id) => hoveredShape === id);
            }

            drawShapeStyled(shape, isSelected, isHovered, chainId, partType);
        });

        // Draw offset paths (solid green for offset, dashed green for original)
        drawOffsetPaths();

        // Draw rapids (light blue thin lines)
        drawRapids();

        // Draw path endpoints (green start, red end)
        drawPathEndpoints();

        // Draw lead-ins and lead-outs
        drawLeads();

        // Draw chevron arrows along paths
        drawPathChevrons();

        // Draw stage-specific overlays
        if (currentOverlay) {
            drawOverlays(currentOverlay);
        }

        ctx.restore();
    }

    function drawOffsetPaths() {
        if (!pathsState || pathsState.paths.length === 0) return;

        pathsState.paths.forEach((path: Path) => {
            // Only draw offset paths for enabled paths with enabled operations
            const operation = operations.find(
                (op) => op.id === path.operationId
            );
            if (!operation || !operation.enabled || !path.enabled) return;

            // Only draw if path has calculated offset
            if (!path.calculatedOffset) return;

            // Comprehensive validation of offset geometry before rendering
            if (
                !path.calculatedOffset.originalShapes ||
                !path.calculatedOffset.offsetShapes
            ) {
                console.warn(
                    `Invalid offset geometry for path ${path.id}: missing shape arrays`
                );
                return;
            }

            if (
                !Array.isArray(path.calculatedOffset.originalShapes) ||
                !Array.isArray(path.calculatedOffset.offsetShapes)
            ) {
                console.warn(
                    `Invalid offset geometry for path ${path.id}: shape arrays are not arrays`
                );
                return;
            }

            // Validate that shapes have required properties
            if (
                path.calculatedOffset.originalShapes.length === 0 ||
                path.calculatedOffset.offsetShapes.length === 0
            ) {
                console.warn(
                    `Invalid offset geometry for path ${path.id}: empty shape arrays`
                );
                return;
            }

            const isPathSelected = selectedPathId && selectedPathId === path.id;
            const isPathHighlighted =
                highlightedPathId && highlightedPathId === path.id;

            ctx.save();

            try {
                // Define color constants for visual consistency
                const pathColors = {
                    originalLightGreen: 'rgba(0, 133, 84, 0.6)', // Light green for original paths when offset exists
                    offsetGreen: 'rgb(0, 133, 84)', // Green for offset paths (same as original normal)
                    selectedDark: 'rgb(0, 133, 84)', // Dark green for selected
                    highlighted: 'rgb(0, 133, 84)', // Dark green for highlighted
                };

                // Draw original shapes as dashed light green lines FIRST (background layer)
                ctx.setLineDash([5, 3]); // Standardized dash pattern in screen pixels
                ctx.strokeStyle = pathColors.originalLightGreen;
                ctx.lineWidth = coordinator.screenToWorldDistance(1); // 1px original paths
                ctx.lineCap = 'round'; // Professional appearance
                ctx.lineJoin = 'round'; // Professional appearance

                path.calculatedOffset.originalShapes.forEach((shape, index) => {
                    try {
                        drawShape(shape);
                    } catch (error) {
                        console.warn(
                            `Error rendering original shape ${index} for path ${path.id}:`,
                            error
                        );
                    }
                });

                // Draw offset shapes as solid green lines SECOND (foreground layer)
                ctx.setLineDash([]); // Solid line pattern
                ctx.shadowColor = 'transparent'; // Reset shadow
                ctx.shadowBlur = 0;

                // Maintain professional line appearance
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                path.calculatedOffset.offsetShapes.forEach((shape, index) => {
                    try {
                        // Check if this specific offset shape is selected
                        const isOffsetShapeSelected =
                            selectedOffsetShape &&
                            selectedOffsetShape.id === shape.id;

                        // Set styling based on selection state with proper hierarchy
                        if (isOffsetShapeSelected) {
                            ctx.strokeStyle = '#ff6600'; // Orange for selected offset shape
                            ctx.lineWidth =
                                coordinator.screenToWorldDistance(2); // 2px selected offset shape
                        } else if (isPathSelected) {
                            ctx.strokeStyle = pathColors.selectedDark; // Dark green for selected path
                            ctx.lineWidth =
                                coordinator.screenToWorldDistance(3); // 3px selected paths
                        } else if (isPathHighlighted) {
                            ctx.strokeStyle = pathColors.highlighted; // Dark green for highlighted
                            ctx.lineWidth =
                                coordinator.screenToWorldDistance(2.5);
                            ctx.shadowColor = pathColors.highlighted;
                            ctx.shadowBlur =
                                coordinator.screenToWorldDistance(4);
                        } else {
                            ctx.strokeStyle = pathColors.offsetGreen; // Green for offset paths
                            ctx.lineWidth =
                                coordinator.screenToWorldDistance(2); // 2px offset paths
                        }

                        drawShape(shape);

                        // Reset shadow after each shape if it was applied
                        if (isPathHighlighted && !isOffsetShapeSelected) {
                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;
                        }
                    } catch (error) {
                        console.warn(
                            `Error rendering offset shape ${index} for path ${path.id}:`,
                            error
                        );
                    }
                });

                // Render gap fills if they exist (filler shapes and modified shapes)
                if (
                    path.calculatedOffset.gapFills &&
                    path.calculatedOffset.gapFills.length > 0
                ) {
                    ctx.save();

                    // Use same color logic as offset shapes for consistency
                    if (isPathSelected) {
                        ctx.strokeStyle = pathColors.selectedDark; // Dark green for selected path
                        ctx.lineWidth = coordinator.screenToWorldDistance(3); // 3px selected paths
                    } else if (isPathHighlighted) {
                        ctx.strokeStyle = pathColors.highlighted; // Dark green for highlighted
                        ctx.lineWidth = coordinator.screenToWorldDistance(2.5);
                        ctx.shadowColor = pathColors.highlighted;
                        ctx.shadowBlur = coordinator.screenToWorldDistance(4);
                    } else {
                        ctx.strokeStyle = pathColors.offsetGreen; // Green for gap fills (same as offset paths)
                        ctx.lineWidth = coordinator.screenToWorldDistance(2); // 2px gap fills
                    }
                    ctx.setLineDash([]); // Solid line

                    for (const gapFill of path.calculatedOffset.gapFills) {
                        // Render filler shape if it exists
                        if (gapFill.fillerShape) {
                            try {
                                drawShape(gapFill.fillerShape);
                            } catch (error) {
                                console.warn(
                                    `Error rendering gap filler shape for path ${path.id}:`,
                                    error
                                );
                            }
                        }

                        // Render modified shapes (these replace the original offset shapes in gap areas)
                        for (const modifiedShapeEntry of gapFill.modifiedShapes) {
                            try {
                                drawShape(modifiedShapeEntry.modified);
                            } catch (error) {
                                console.warn(
                                    `Error rendering gap modified shape for path ${path.id}:`,
                                    error
                                );
                            }
                        }
                    }

                    // Reset shadow after gap fills if it was applied
                    if (isPathHighlighted) {
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                    }

                    ctx.restore();
                }
            } catch (error) {
                console.error(`Error rendering offset path ${path.id}:`, error);
            } finally {
                ctx.restore();
            }
        });
    }

    function drawOriginCross() {
        const crossSize = coordinator.screenToWorldDistance(20); // Fixed size regardless of zoom

        ctx.strokeStyle = '#888888';
        ctx.lineWidth = coordinator.screenToWorldDistance(1);

        // Draw horizontal line
        ctx.beginPath();
        ctx.moveTo(-crossSize, 0);
        ctx.lineTo(crossSize, 0);
        ctx.stroke();

        // Draw vertical line
        ctx.beginPath();
        ctx.moveTo(0, -crossSize);
        ctx.lineTo(0, crossSize);
        ctx.stroke();
    }

    function drawRapids() {
        if (!showRapids || rapids.length === 0) return;

        ctx.save();

        rapids.forEach((rapid: { id: string; start: any; end: any }) => {
            // Determine visual state
            const isSelected = selectedRapidId === rapid.id;
            const isHighlighted = highlightedRapidId === rapid.id;

            // Set styling based on state
            if (isSelected) {
                ctx.strokeStyle = '#ff6600'; // Orange for selected (same as selected shapes)
                ctx.lineWidth = coordinator.screenToWorldDistance(2); // Thicker line
                ctx.setLineDash([]); // Solid line for selected
            } else if (isHighlighted) {
                ctx.strokeStyle = '#ff6600'; // Orange for highlighted
                ctx.lineWidth = coordinator.screenToWorldDistance(1.5); // Medium thickness
                const dashSize = coordinator.screenToWorldDistance(3);
                ctx.setLineDash([dashSize, dashSize]); // Shorter dashes
            } else {
                ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for normal
                ctx.lineWidth = coordinator.screenToWorldDistance(0.5); // Thin line
                const dashSize = coordinator.screenToWorldDistance(5);
                ctx.setLineDash([dashSize, dashSize]); // Normal dashes
            }

            ctx.beginPath();
            ctx.moveTo(rapid.start.x, rapid.start.y);
            ctx.lineTo(rapid.end.x, rapid.end.y);
            ctx.stroke();
        });

        ctx.restore();
    }

    function drawPathEndpoints() {
        if (!pathsState || pathsState.paths.length === 0) return;

        const pointRadius = coordinator.screenToWorldDistance(3); // Fixed size regardless of zoom

        pathsState.paths.forEach((path) => {
            // Only draw endpoints for enabled paths with enabled operations
            const operation = operations.find(
                (op) => op.id === path.operationId
            );
            if (!operation || !operation.enabled || !path.enabled) return;

            // Get the chain for this path to find start/end points
            const chain = chains.find((c) => c.id === path.chainId);
            if (!chain || chain.shapes.length === 0) return;

            // Use offset shapes if they exist, otherwise use original chain shapes
            const shapesToUse =
                path.calculatedOffset &&
                path.calculatedOffset.offsetShapes.length > 0
                    ? path.calculatedOffset.offsetShapes
                    : chain.shapes;

            // Get first and last shape
            const firstShape = shapesToUse[0];
            const lastShape = shapesToUse[shapesToUse.length - 1];

            if (!firstShape || !lastShape) return;

            // Get start point of first shape
            const startPoint = getShapeStartPoint(firstShape);
            if (startPoint) {
                ctx.save();
                ctx.fillStyle = 'rgb(0, 133, 84)'; // Green for start
                ctx.beginPath();
                ctx.arc(
                    startPoint.x,
                    startPoint.y,
                    pointRadius,
                    0,
                    2 * Math.PI
                );
                ctx.fill();
                ctx.restore();
            }

            // Get end point of last shape
            const endPoint = getShapeEndPoint(lastShape);
            if (endPoint) {
                ctx.save();
                ctx.fillStyle = 'rgb(133, 18, 0)'; // Red for end
                ctx.beginPath();
                ctx.arc(endPoint.x, endPoint.y, pointRadius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    function drawLeads() {
        if (!leadVisualization) return;
        leadVisualization.drawLeads();
    }

    function drawPathChevrons() {
        if (!pathsState || pathsState.paths.length === 0) return;

        pathsState.paths.forEach((path) => {
            // Only draw chevrons for enabled paths with enabled operations
            const operation = operations.find(
                (op) => op.id === path.operationId
            );
            if (!operation || !operation.enabled || !path.enabled) return;

            let shapesToSample: Shape[] = [];

            // Use execution chain if available (contains shapes in correct execution order)
            if (path.cutChain && path.cutChain.shapes.length > 0) {
                shapesToSample = path.cutChain.shapes;
            } else {
                // Fallback to original shapes for backward compatibility
                // IMPORTANT: Don't manually apply cut direction here - it conflicts with stored chain direction
                if (
                    path.calculatedOffset &&
                    path.calculatedOffset.offsetShapes &&
                    path.calculatedOffset.offsetShapes.length > 0
                ) {
                    shapesToSample = path.calculatedOffset.offsetShapes;
                } else {
                    // Get the chain for this path and use original shapes
                    const chain = chains.find((c) => c.id === path.chainId);
                    if (!chain || chain.shapes.length === 0) return;

                    shapesToSample = chain.shapes;
                }
            }

            // Use the new utility to sample at regular distance intervals
            const chevronSamples = samplePathAtDistanceIntervals(
                shapesToSample,
                CHEVRON_SPACING_UNITS
            );

            // Draw chevron arrows at the sampled locations
            const chevronSize = coordinator.screenToWorldDistance(8); // Size of chevrons in world units

            chevronSamples.forEach((sample) => {
                // Get the direction from the sampling function
                // Since cutChain shapes have been properly reversed (both order and geometry),
                // the direction vectors are already correct for the intended cut direction
                let dirX = sample.direction.x;
                let dirY = sample.direction.y;

                // Calculate perpendicular vector for chevron wings
                const perpX = -dirY;
                const perpY = dirX;

                drawChevronArrow(
                    sample.point,
                    dirX,
                    dirY,
                    perpX,
                    perpY,
                    chevronSize
                );
            });
        });
    }

    function drawChevronArrow(
        center: Point2D,
        dirX: number,
        dirY: number,
        perpX: number,
        perpY: number,
        size: number
    ) {
        ctx.save();
        ctx.strokeStyle = 'rgb(0, 133, 84)'; // Green color to match path color
        ctx.lineWidth = coordinator.screenToWorldDistance(1.5);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Calculate chevron wing points (90 degree angle between wings)
        const wingLength = size * 0.7;
        const backOffset = size * 0.3;

        // Wing points: 45 degrees on each side of the direction vector
        const wing1X =
            center.x -
            backOffset * dirX +
            wingLength *
                (dirX * Math.cos(Math.PI / 4) + perpX * Math.sin(Math.PI / 4));
        const wing1Y =
            center.y -
            backOffset * dirY +
            wingLength *
                (dirY * Math.cos(Math.PI / 4) + perpY * Math.sin(Math.PI / 4));

        const wing2X =
            center.x -
            backOffset * dirX +
            wingLength *
                (dirX * Math.cos(Math.PI / 4) - perpX * Math.sin(Math.PI / 4));
        const wing2Y =
            center.y -
            backOffset * dirY +
            wingLength *
                (dirY * Math.cos(Math.PI / 4) - perpY * Math.sin(Math.PI / 4));

        const tipX = center.x + size * 0.4 * dirX;
        const tipY = center.y + size * 0.4 * dirY;

        // Draw the chevron (two lines forming arrow shape)
        ctx.beginPath();
        ctx.moveTo(wing1X, wing1Y);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(wing2X, wing2Y);
        ctx.stroke();

        ctx.restore();
    }

    function drawLine(line: Line) {
        ctx.beginPath();
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
        ctx.stroke();
    }

    function drawCircle(circle: Circle) {
        ctx.beginPath();
        ctx.arc(
            circle.center.x,
            circle.center.y,
            circle.radius,
            0,
            2 * Math.PI
        );
        ctx.stroke();
    }

    function drawArc(arc: Arc) {
        ctx.beginPath();
        ctx.arc(
            arc.center.x,
            arc.center.y,
            arc.radius,
            normalizeAngle(arc.startAngle),
            normalizeAngle(arc.endAngle),
            arc.clockwise
        );
        ctx.stroke();
    }

    function drawPolyline(polyline: Polyline) {
        if (!polyline.shapes || polyline.shapes.length === 0) return;

        // Draw each shape in the polyline using drawLine or drawArc
        for (const shape of polyline.shapes) {
            switch (shape.type) {
                case GeometryType.LINE:
                    drawLine(shape.geometry as Line);
                    break;
                case GeometryType.ARC:
                    drawArc(shape.geometry as Arc);
                    break;
            }
        }

        // Handle closing segment for closed polylines
        // if (polyline.closed && polyline.shapes.length >= 2) {
        //   const lastShape = polyline.shapes[polyline.shapes.length - 1];
        //   const firstShape = polyline.shapes[0];

        //   const lastEndPoint = getShapeEndPoint(lastShape);
        //   const firstStartPoint = getShapeStartPoint(firstShape);

        //   // Only draw closing line if endpoints don't already meet
        //   if (lastEndPoint && firstStartPoint) {
        //     const dx = lastEndPoint.x - firstStartPoint.x;
        //     const dy = lastEndPoint.y - firstStartPoint.y;
        //     const distance = Math.sqrt(dx * dx + dy * dy);

        //     if (distance > EPSILON) {
        //       const closingLine: Line = {
        //         start: lastEndPoint,
        //         end: firstStartPoint
        //       };
        //       drawLine(closingLine);
        //     }
        //   }
        // }
    }

    function drawEllipse(ellipse: any, shape: Shape) {
        // Try to get cached tessellation first
        const cachedPoints = getCachedTessellation(shape);
        const tessellatedPoints =
            cachedPoints ||
            tessellateEllipse(ellipse, {
                numPoints: ELLIPSE_TESSELLATION_POINTS,
            });

        if (tessellatedPoints.length < 2) return;

        // Determine if this is an ellipse arc or full ellipse
        const isArc =
            typeof ellipse.startParam === 'number' &&
            typeof ellipse.endParam === 'number';

        ctx.beginPath();
        ctx.moveTo(tessellatedPoints[0].x, tessellatedPoints[0].y);

        for (let i = 1; i < tessellatedPoints.length; i++) {
            ctx.lineTo(tessellatedPoints[i].x, tessellatedPoints[i].y);
        }

        // Close path for full ellipses (not arcs)
        if (!isArc) {
            ctx.closePath();
        }

        ctx.stroke();
    }

    function drawSpline(spline: any, shape: Shape) {
        // Try to get cached tessellation first
        const cachedPoints = getCachedTessellation(shape);
        let tessellatedPoints = cachedPoints;

        if (!tessellatedPoints) {
            // Use comprehensive tessellation system with knot vector conversion
            const result = tessellateSpline(spline, {
                method: 'verb-nurbs',
                tolerance: SPLINE_TESSELLATION_TOLERANCE,
            });

            if (!result.success || result.points.length < 2) return;
            tessellatedPoints = result.points;
        }

        if (tessellatedPoints.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(tessellatedPoints[0].x, tessellatedPoints[0].y);

        for (let i = 1; i < tessellatedPoints.length; i++) {
            ctx.lineTo(tessellatedPoints[i].x, tessellatedPoints[i].y);
        }

        if (spline.closed) {
            ctx.closePath();
        }

        ctx.stroke();
    }

    function drawShape(shape: Shape) {
        switch (shape.type) {
            case GeometryType.LINE:
                const line = shape.geometry as Line;
                drawLine(line);
                break;

            case GeometryType.CIRCLE:
                const circle = shape.geometry as Circle;
                drawCircle(circle);
                break;

            case GeometryType.ARC:
                const arc = shape.geometry as Arc;
                drawArc(arc);
                break;

            case GeometryType.POLYLINE:
                const polyline = shape.geometry as Polyline;
                drawPolyline(polyline);
                break;

            case GeometryType.ELLIPSE:
                const ellipse = shape.geometry as Ellipse;
                drawEllipse(ellipse, shape);
                break;

            case GeometryType.SPLINE:
                const spline = shape.geometry as Spline;
                drawSpline(spline, shape);
                break;
        }
    }

    function drawShapeStyled(
        shape: Shape,
        isSelected: boolean,
        isHovered: boolean = false,
        chainId: string | null = null,
        partType: 'shell' | 'hole' | null = null
    ) {
        // Save context state
        ctx.save();

        // Check if this shape is part of the highlighted part
        const isPartHighlighted =
            chainId && highlightedChainIds.includes(chainId);

        // Check if this shape is part of the hovered part
        const isPartHovered = chainId && hoveredChainIds.includes(chainId);

        // Check if this shape is part of the selected part
        const isPartSelected = chainId && selectedChainIds.includes(chainId);

        // Check if this shape is part of the selected chain
        const isChainSelected = chainId && selectedChainId === chainId;

        // Check if this shape is part of the highlighted chain
        const isChainHighlighted = chainId && highlightedChainId === chainId;

        // Check if this chain has paths (green highlighting)
        const hasPath = chainId && chainsWithPaths.includes(chainId);

        // Check if this path is selected or highlighted
        const isPathSelected =
            selectedPathId &&
            pathsState.paths.some(
                (p) => p.id === selectedPathId && p.chainId === chainId
            );
        const isPathHighlighted =
            highlightedPathId &&
            pathsState.paths.some(
                (p) => p.id === highlightedPathId && p.chainId === chainId
            );

        // Priority: selected > hovered > path selected > path highlighted > chain selected > part selected > chain highlighted > part highlighted > part hovered > path (green) > part type > chain > normal
        if (isSelected) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = coordinator.screenToWorldDistance(2);
        } else if (isHovered) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = coordinator.screenToWorldDistance(1.5);
        } else if (isPathSelected) {
            ctx.strokeStyle = 'rgb(0, 133, 84)'; // Dark green color for selected path
            ctx.lineWidth = coordinator.screenToWorldDistance(3);
        } else if (isPathHighlighted) {
            ctx.strokeStyle = '#15803d'; // Dark green color for highlighted path
            ctx.lineWidth = coordinator.screenToWorldDistance(3);
            ctx.shadowColor = '#15803d';
            ctx.shadowBlur = coordinator.screenToWorldDistance(4);
        } else if (isChainSelected) {
            ctx.strokeStyle = '#f59e0b'; // Dark amber color for selected chain
            ctx.lineWidth = coordinator.screenToWorldDistance(2);
        } else if (isPartSelected) {
            ctx.strokeStyle = '#f59e0b'; // Dark amber color for selected part
            ctx.lineWidth = coordinator.screenToWorldDistance(2.5);
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = coordinator.screenToWorldDistance(2);
        } else if (isChainHighlighted) {
            ctx.strokeStyle = '#fbbf24'; // Light amber color for highlighted chain
            ctx.lineWidth = coordinator.screenToWorldDistance(2);
        } else if (isPartHighlighted) {
            ctx.strokeStyle = '#f59e0b'; // Amber color for highlighted part
            ctx.lineWidth = coordinator.screenToWorldDistance(2.5);
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = coordinator.screenToWorldDistance(3);
        } else if (isPartHovered) {
            ctx.strokeStyle = '#fbbf24'; // Light amber color for hovered part
            ctx.lineWidth = coordinator.screenToWorldDistance(2);
        } else if (hasPath) {
            ctx.strokeStyle = 'rgb(0, 133, 84)'; // Green color for chains with paths
            ctx.lineWidth = coordinator.screenToWorldDistance(2);
        } else if (partType === 'shell') {
            ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for part shells
            ctx.lineWidth = coordinator.screenToWorldDistance(1.5);
        } else if (partType === 'hole') {
            ctx.strokeStyle = 'rgba(0, 83, 135, 0.6)'; // Lighter RAL 5005 Signal Blue for holes
            ctx.lineWidth = coordinator.screenToWorldDistance(1.5);
        } else if (chainId) {
            ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for chained shapes (fallback)
            ctx.lineWidth = coordinator.screenToWorldDistance(1.5);
        } else {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = coordinator.screenToWorldDistance(1);
        }

        // Render the shape geometry using the extracted function
        drawShape(shape);

        // Restore context state
        ctx.restore();
    }

    function drawOverlays(overlay: any) {
        // Draw shape points (Edit stage)
        if (overlay.shapePoints && overlay.shapePoints.length > 0) {
            overlay.shapePoints.forEach((point: any) => {
                drawOverlayPoint(
                    point.x,
                    point.y,
                    point.type,
                    coordinator.screenToWorldDistance(4)
                );
            });
        }

        // Draw chain endpoints (Prepare stage)
        if (overlay.chainEndpoints && overlay.chainEndpoints.length > 0) {
            overlay.chainEndpoints.forEach((endpoint: any) => {
                drawChainEndpoint(
                    endpoint.x,
                    endpoint.y,
                    endpoint.type,
                    coordinator.screenToWorldDistance(6)
                );
            });
        }

        // Draw tessellation points (Program stage)
        if (
            overlay.tessellationPoints &&
            overlay.tessellationPoints.length > 0
        ) {
            overlay.tessellationPoints.forEach((point: any) => {
                drawTessellationPoint(
                    point.x,
                    point.y,
                    coordinator.screenToWorldDistance(2)
                );
            });
        }

        // Draw tool head (Simulate stage)
        if (overlay.toolHead && overlay.toolHead.visible) {
            drawToolHead(
                overlay.toolHead.x,
                overlay.toolHead.y,
                coordinator.screenToWorldDistance(8)
            );
        }
    }

    function drawOverlayPoint(
        x: number,
        y: number,
        type: string,
        size: number
    ) {
        ctx.save();

        switch (type) {
            case 'origin':
                ctx.fillStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
                break;
            case 'start':
                ctx.fillStyle = 'rgb(0, 133, 84)'; // Green
                break;
            case 'end':
                ctx.fillStyle = 'rgb(133, 18, 0)'; // Red
                break;
            default:
                ctx.fillStyle = '#888888'; // Gray
        }

        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    function drawChainEndpoint(
        x: number,
        y: number,
        type: string,
        size: number
    ) {
        ctx.save();

        // Draw white border
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(
            x,
            y,
            size + coordinator.screenToWorldDistance(1),
            0,
            2 * Math.PI
        );
        ctx.fill();

        // Draw colored center
        if (type === 'start') {
            ctx.fillStyle = 'rgb(0, 133, 84)'; // Emerald green
        } else {
            ctx.fillStyle = 'rgb(133, 18, 0)'; // Red
        }

        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    function drawTessellationPoint(x: number, y: number, size: number) {
        ctx.save();
        ctx.fillStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    function drawToolHead(x: number, y: number, size: number) {
        ctx.save();
        ctx.strokeStyle = 'rgb(133, 18, 0)'; // Red
        ctx.lineWidth = coordinator.screenToWorldDistance(2);

        // Draw cross
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();

        ctx.restore();
    }

    function getShapeAtPoint(point: Point2D): Shape | null {
        if (!drawing) return null;

        // Simple hit testing - check if point is near shape
        const tolerance = coordinator.screenToWorldDistance(5);

        for (const shape of drawing.shapes) {
            // Check if layer is visible before hit testing (only if respectLayerVisibility is true)
            if (respectLayerVisibility) {
                const shapeLayer = shape.layer || '0';
                const isVisible = layerVisibility[shapeLayer] !== false; // Default to visible if not set

                if (!isVisible) continue; // Skip invisible shapes
            }

            if (isPointNearShape(point, shape, tolerance)) {
                return shape;
            }
        }

        return null;
    }

    function getOffsetShapeAtPoint(
        point: Point2D
    ): { shape: Shape; pathId: string } | null {
        if (!pathsState?.paths) return null;

        const tolerance = coordinator.screenToWorldDistance(5);

        // Iterate through all paths that have calculated offsets
        for (const path of pathsState.paths) {
            // Only check enabled paths with offset shapes
            if (!path.enabled || !path.calculatedOffset?.offsetShapes) continue;

            // Check if the operation for this path is enabled
            const operation = operations.find(
                (op) => op.id === path.operationId
            );
            if (!operation || !operation.enabled) continue;

            // Check each offset shape for proximity to the point
            for (const offsetShape of path.calculatedOffset.offsetShapes) {
                if (isPointNearShape(point, offsetShape, tolerance)) {
                    return { shape: offsetShape, pathId: path.id };
                }
            }
        }

        return null;
    }

    function getRapidAtPoint(
        point: Point2D
    ): { id: string; start: any; end: any } | null {
        if (!showRapids || rapids.length === 0) return null;

        const tolerance = coordinator.screenToWorldDistance(5); // Fixed tolerance in screen pixels

        for (const rapid of rapids) {
            if (distanceToLine(point, rapid.start, rapid.end) < tolerance) {
                return rapid;
            }
        }

        return null;
    }

    function getPartAtPoint(point: Point2D): string | null {
        if (!parts || parts.length === 0) return null;

        // Check each part to see if the point is inside it (shell but outside holes)
        for (const part of parts) {
            if (isPointInsidePart(point, part)) {
                return part.id;
            }
        }

        return null;
    }

    function isPointNearShape(
        point: Point2D,
        shape: Shape,
        tolerance: number
    ): boolean {
        switch (shape.type) {
            case GeometryType.LINE:
                const line = shape.geometry as Line;
                return distanceToLine(point, line.start, line.end) < tolerance;

            case GeometryType.CIRCLE:
                const circle = shape.geometry as Circle;
                const distToCenter = distance(point, circle.center);
                return Math.abs(distToCenter - circle.radius) < tolerance;

            case GeometryType.ARC:
                const arc = shape.geometry as Arc;
                const distToCenterArc = distance(point, arc.center);
                // Check if point is near the arc circumference
                if (Math.abs(distToCenterArc - arc.radius) > tolerance) {
                    return false;
                }
                // Check if point is within the arc's angular range
                const pointAngle = Math.atan2(
                    point.y - arc.center.y,
                    point.x - arc.center.x
                );
                return isAngleInArcRange(
                    pointAngle,
                    arc.startAngle,
                    arc.endAngle,
                    arc.clockwise
                );

            case GeometryType.POLYLINE:
                const polyline = shape.geometry as Polyline;

                if (!polyline.shapes || polyline.shapes.length === 0)
                    return false;

                // Check each shape in the polyline
                for (const polylineShape of polyline.shapes) {
                    if (isPointNearShape(point, polylineShape, tolerance)) {
                        return true;
                    }
                }

                return false;

            case GeometryType.ELLIPSE:
                const ellipse = shape.geometry as Ellipse;

                // Calculate distance from point to ellipse perimeter
                const distanceToPerimeter = distanceFromEllipsePerimeter(
                    point,
                    ellipse
                );

                // Check if within tolerance
                if (distanceToPerimeter > tolerance) {
                    return false;
                }

                // For full ellipses, no additional checks needed
                if (isFullEllipse(ellipse)) {
                    return true;
                }

                // For ellipse arcs, check if point is within angular range
                const { majorAxisLength, minorAxisLength, majorAxisAngle } =
                    getEllipseParameters(ellipse);

                // Transform point to ellipse coordinate system
                const dx = point.x - ellipse.center.x;
                const dy = point.y - ellipse.center.y;
                const rotatedX =
                    dx * Math.cos(-majorAxisAngle) -
                    dy * Math.sin(-majorAxisAngle);
                const rotatedY =
                    dx * Math.sin(-majorAxisAngle) +
                    dy * Math.cos(-majorAxisAngle);

                // Calculate point parameter in ellipse coordinate system
                const normalizedX = rotatedX / majorAxisLength;
                const normalizedY = rotatedY / minorAxisLength;
                const pointParam = Math.atan2(normalizedY, normalizedX);

                // Check if point parameter is within arc range
                const startParam = ellipse.startParam!;
                const endParam = ellipse.endParam!;

                // Normalize parameters to [0, 2π]
                const normalizeParam = (param: number) => {
                    while (param < 0) param += 2 * Math.PI;
                    while (param >= 2 * Math.PI) param -= 2 * Math.PI;
                    return param;
                };

                const normStart = normalizeParam(startParam);
                const normEnd = normalizeParam(endParam);
                const normPoint = normalizeParam(pointParam);

                if (normStart <= normEnd) {
                    return normPoint >= normStart && normPoint <= normEnd;
                } else {
                    // Arc crosses 0 degrees
                    return normPoint >= normStart || normPoint <= normEnd;
                }

            case GeometryType.SPLINE:
                const spline = shape.geometry as Spline;
                // For hit testing, use properly evaluated NURBS points
                const evaluatedPoints = sampleNURBS(spline, 50); // Use fewer points for hit testing performance

                if (!evaluatedPoints || evaluatedPoints.length < 2)
                    return false;

                for (let i = 0; i < evaluatedPoints.length - 1; i++) {
                    if (
                        distanceToLine(
                            point,
                            evaluatedPoints[i],
                            evaluatedPoints[i + 1]
                        ) < tolerance
                    ) {
                        return true;
                    }
                }

                // Check closing segment if spline is closed
                if (spline.closed && evaluatedPoints.length > 2) {
                    if (
                        distanceToLine(
                            point,
                            evaluatedPoints[evaluatedPoints.length - 1],
                            evaluatedPoints[0]
                        ) < tolerance
                    ) {
                        return true;
                    }
                }

                return false;

            default:
                return false;
        }
    }

    function distance(p1: Point2D, p2: Point2D): number {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    function isAngleInArcRange(
        angle: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): boolean {
        // Normalize angles to [0, 2π]
        const normalizeAngle = (a: number) => {
            while (a < 0) a += 2 * Math.PI;
            while (a >= 2 * Math.PI) a -= 2 * Math.PI;
            return a;
        };

        const normAngle = normalizeAngle(angle);
        const normStart = normalizeAngle(startAngle);
        const normEnd = normalizeAngle(endAngle);

        if (clockwise) {
            // For clockwise arcs, we traverse from start to end in clockwise direction
            if (normStart >= normEnd) {
                return normAngle <= normStart && normAngle >= normEnd;
            } else {
                // Arc crosses 0 degrees in clockwise direction
                return normAngle <= normStart || normAngle >= normEnd;
            }
        } else {
            // For counter-clockwise arcs (default behavior)
            if (normStart <= normEnd) {
                return normAngle >= normStart && normAngle <= normEnd;
            } else {
                // Arc crosses 0 degrees
                return normAngle >= normStart || normAngle <= normEnd;
            }
        }
    }

    function distanceToLine(
        point: Point2D,
        lineStart: Point2D,
        lineEnd: Point2D
    ): number {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }

    //
    // Event handlers
    //

    function handleMouseDown(e: MouseEvent) {
        isMouseDown = true;
        mousePos = { x: e.offsetX, y: e.offsetY };
        dragStart = mousePos;
        mouseButton = e.button; // Track which button was pressed (0=left, 1=middle, 2=right)

        // Only handle shape selection with left mouse button
        if (e.button === 0) {
            const worldPos = coordinator.screenToWorld(mousePos);

            // Check for rapid selection first (rapids are on top)
            const rapid = getRapidAtPoint(worldPos);
            if (rapid) {
                // Handle rapid selection
                if (selectedRapidId === rapid.id) {
                    selectRapid(null); // Deselect if already selected
                } else {
                    selectRapid(rapid.id);
                }
                return; // Don't process shape selection if rapid was clicked
            }

            // In Program stage, check for offset shape selection
            if (interactionMode === 'chains' && currentStage === 'program') {
                const offsetHit = getOffsetShapeAtPoint(worldPos);
                if (offsetHit) {
                    // Select the offset shape
                    drawingStore.selectOffsetShape(offsetHit.shape);
                    return; // Don't process regular shape selection
                } else {
                    // Clear offset shape selection if clicking elsewhere
                    drawingStore.clearOffsetShapeSelection();
                }
            }

            const shape = getShapeAtPoint(worldPos);

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
                    const partId = getPartAtPoint(worldPos);
                    if (partId) {
                        // Clicked inside part but not on any shape - select the part
                        onPartClick(partId);
                        return;
                    }
                }

                if (!e.ctrlKey) {
                    // Clear all selections when clicking in empty space
                    drawingStore.clearSelection();
                    clearChainSelection();
                    clearHighlight();
                    selectPart(null);
                    pathStore.selectPath(null);
                    clearPathHighlight();
                    selectRapid(null);
                    clearRapidHighlight();
                }
            }
        }
    }

    function handleMouseMove(e: MouseEvent) {
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
                // Pan view with middle or right mouse button - use optimized pan manager
                const delta = {
                    x: newMousePos.x - mousePos.x,
                    y: newMousePos.y - mousePos.y,
                };

                const newOffset = {
                    x: offset.x + delta.x,
                    y: offset.y + delta.y,
                };

                // Use pan state manager for smooth updates
                panStateManager.setPanOffset(newOffset);
                drawingStore.setViewTransform(scale, newOffset);
            }
        } else {
            // Throttle hover detection to improve performance
            if (hoverTimeout !== null) {
                clearTimeout(hoverTimeout);
            }

            hoverTimeout = setTimeout(() => {
                // Handle hover detection when not dragging
                const worldPos = coordinator.screenToWorld(newMousePos);
                const shape = getShapeAtPoint(worldPos);

                if (interactionMode === 'shapes') {
                    // Edit mode - show hover for individual shapes
                    drawingStore.setHoveredShape(shape ? shape.id : null);
                } else if (interactionMode === 'chains') {
                    // Program mode - show hover for chains (set to actual shape, rendering handles chain highlighting)
                    drawingStore.setHoveredShape(shape ? shape.id : null);
                } else if (interactionMode === 'paths') {
                    // Simulation mode - don't show individual shape hover for selection purposes
                    // Only hover shapes that are part of selectable paths
                    if (shape) {
                        const chainId = getShapeChainId(shape.id, chains);
                        if (chainId && chainsWithPaths.includes(chainId)) {
                            drawingStore.setHoveredShape(shape.id);
                        } else {
                            drawingStore.setHoveredShape(null);
                        }
                    } else {
                        drawingStore.setHoveredShape(null);
                    }
                }
                hoverTimeout = null;
            }, 16); // ~60fps throttling (16ms)
        }

        mousePos = newMousePos;
    }

    function handleMouseUp() {
        isMouseDown = false;
        dragStart = null;
        mouseButton = 0; // Reset mouse button
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();

        // Calculate new scale in 5% increments
        const currentPercent = Math.round(scale * 100);
        const increment = e.deltaY > 0 ? -5 : 5;
        const newPercent = Math.max(5, currentPercent + increment); // Minimum 5% zoom
        const newScale = newPercent / 100;

        // Zoom towards mouse position using coordinate transformer
        const newOffset = coordinator.calculateZoomOffset(
            mousePos,
            scale,
            newScale
        );

        drawingStore.setViewTransform(newScale, newOffset);
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

    // All reactive renders are now handled by the consolidated reactive block above
</script>

<div bind:this={canvasContainer} class="canvas-container">
    <canvas
        bind:this={canvas}
        class="drawing-canvas"
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        on:wheel={handleWheel}
        on:contextmenu={handleContextMenu}
        tabindex="0"
        on:keydown={handleKeyDown}
    ></canvas>

    <!-- Lead Visualization Component -->
    <LeadVisualization
        bind:this={leadVisualization}
        {ctx}
        {coordinator}
        paths={pathsState?.paths || []}
        {operations}
        parts={parts || []}
        chains={chains || []}
        {currentStage}
        isSimulating={currentStage === 'simulate'}
    />
</div>

<style>
    .canvas-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    .drawing-canvas {
        display: block; /* Important: prevent inline-block spacing issues */
        width: 100%;
        height: 100%;
        cursor: crosshair;
        outline: none;
    }

    .drawing-canvas:active {
        cursor: move;
    }
</style>
