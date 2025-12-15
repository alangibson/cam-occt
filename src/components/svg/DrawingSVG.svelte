<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import panzoom, { type PanZoom } from 'panzoom';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { planStore } from '$lib/stores/plan/store.svelte';
    import ShapeGroup from './ShapeGroup.svelte';
    import ChainGroup from './ChainGroup.svelte';
    import PartGroup from './PartGroup.svelte';
    import CutGroup from './CutGroup.svelte';
    import RapidGroup from './RapidGroup.svelte';
    import CoordinateGroup from './CoordinateGroup.svelte';
    import OverlayGroup from './OverlayGroup.svelte';
    import type { WorkflowStage } from '$lib/stores/workflow/enums';

    type Props = {
        currentStage: WorkflowStage;
    };

    let { currentStage }: Props = $props();

    // SVG and panzoom references
    let panzoomInstance: PanZoom | null = null;
    let resizeObserver: ResizeObserver | null = null;

    // Manual right-click panning state
    let isPanning = $state(false);
    let lastMousePos = $state({ x: 0, y: 0 });

    // Get zoom scale for constant screen sizes - get it directly from panzoom transform
    let zoomScale = $state(1);

    // Calculate viewBox string from viewport dimensions
    // const viewBox = $derived(
    //     `0 0 ${drawingStore.viewport.width} ${drawingStore.viewport.height}`
    // );

    // Get cuts from plan store
    const cuts = $derived(planStore.plan.cuts);

    // Extract parts from drawing layers
    const parts = $derived(
        drawingStore.drawing
            ? Object.values(drawingStore.drawing.layers).flatMap((l) => l.parts)
            : []
    );

    // Extract rapids from cuts
    const rapids = $derived(
        cuts
            .filter((cut) => cut.rapidIn !== null && cut.rapidIn !== undefined)
            .map((cut) => cut.rapidIn!)
    );

    // Used to break reactive loop
    let wasReactiveTransform = false;

    // Initialize panzoom instance with configuration
    function initPanzoomElement(element: SVGGElement) {
        panzoomInstance = panzoom(element, {
            maxZoom: 10,
            minZoom: 0.05,
            smoothScroll: true,
            zoomDoubleClickSpeed: 1, // Disable double-click zoom
            beforeWheel: () => {
                // Allow wheel zoom
                return false;
            },
            beforeMouseDown: (_e) => {
                // Prevent panzoom from handling any mouse button - we'll do it manually
                return true;
            },
        });

        // Listen to panzoom transform events and update zoom scale
        panzoomInstance.on('transform', () => {
            const transform = panzoomInstance?.getTransform();
            if (!transform) return;

            // console.log('panzoom transform', transform);

            // Update DrawingStore with new scale and offset
            // Note: panzoom uses x/y for translation, we use offset
            if (wasReactiveTransform) {
                wasReactiveTransform = false;
            } else {
                drawingStore.setViewTransform(transform.scale, {
                    x: transform.x,
                    y: transform.y,
                });
            }

            zoomScale = transform.scale;
        });
    }

    function initSVGContainerElement(svgContainerElement: HTMLDivElement) {
        const rect = svgContainerElement.getBoundingClientRect();
        drawingStore.setContainerDimensions(rect.width, rect.height);

        // Set up ResizeObserver to track container size changes
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                drawingStore.setContainerDimensions(width, height);
            }
        });
        resizeObserver.observe(svgContainerElement);
    }

    // Sync panzoom state when DrawingStore changes (e.g., from zoomToFit)
    $effect(() => {
        if (!panzoomInstance) return;
        wasReactiveTransform = true;
        // Set zoom first, then position (order matters - zoomAbs affects translation)
        panzoomInstance.zoomAbs(0, 0, drawingStore.scale);
        panzoomInstance.moveTo(drawingStore.pan.x, drawingStore.pan.y);
    });

    // Handle clicks on empty space (background)
    function handleSvgClick(e: MouseEvent) {
        // Only clear if not using modifier keys for multi-select
        if (!e.ctrlKey && !e.metaKey) {
            selectionStore.clearSelections();
        }
    }

    // Handle mouse movement at SVG level to clear hover when not over any shape
    function handleSvgMouseMove(e: MouseEvent) {
        selectionStore.clearHighlights();

        // Handle right-click panning
        if (isPanning && panzoomInstance) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;

            const transform = panzoomInstance.getTransform();
            panzoomInstance.moveTo(transform.x + dx, transform.y + dy);

            lastMousePos = { x: e.clientX, y: e.clientY };
        }
    }

    // Handle mouse down for panning
    function handleMouseDown(e: MouseEvent) {
        // Start panning only on right mouse button
        if (e.button === 2) {
            isPanning = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }
    }

    // Handle mouse up to stop panning
    function handleMouseUp(e: MouseEvent) {
        if (e.button === 2) {
            isPanning = false;
        }
    }

    // Prevent context menu on right-click since we use it for panning
    function handleContextMenu(e: MouseEvent) {
        e.preventDefault();
    }

    // Initialize panzoom on mount
    onMount(() => {
        // Listen for mouseup on window to handle mouse released outside SVG
        const handleWindowMouseUp = (e: MouseEvent) => {
            if (e.button === 2) {
                isPanning = false;
            }
        };
        window.addEventListener('mouseup', handleWindowMouseUp);

        // Clean up window listener on destroy
        return () => {
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    });

    // Cleanup on destroy
    onDestroy(() => {
        if (panzoomInstance) {
            panzoomInstance.dispose();
            panzoomInstance = null;
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    });
</script>

<div use:initSVGContainerElement class="svg-container">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <svg
        class="drawing-svg {isPanning ? 'panning' : ''}"
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="Drawing SVG - Interactive CAD Drawing View"
        onclick={handleSvgClick}
        onmousemove={handleSvgMouseMove}
        onmousedown={handleMouseDown}
        onmouseup={handleMouseUp}
        oncontextmenu={handleContextMenu}
    >
        <!-- panzoom draggable and zoomable layer -->
        <g class="drawing" use:initPanzoomElement>
            <!-- Viewport transform layer: Map from CAD to SVG coordinate systems.
                 1. Flip y axis
                 2. Unit scaling so screen matches physical size
                 3. Offset for panning
             -->
            <g
                class="viewport-transform"
                transform="scale(1, -1) scale({drawingStore.unitScale})"
            >
                <!-- Coordinate cross at origin -->
                <CoordinateGroup {zoomScale} />

                <!-- Overlay layer (toolhead, etc.) -->
                <OverlayGroup {currentStage} {zoomScale} />

                <!-- Shape layer -->
                {#if drawingStore.drawing}
                    <ShapeGroup
                        shapes={drawingStore.drawing.shapes}
                        {zoomScale}
                    />

                    <!-- Chain layer -->
                    <ChainGroup
                        chains={Object.values(
                            drawingStore.drawing.layers
                        ).flatMap((l) => l.chains)}
                        {zoomScale}
                    />

                    <!-- Part layer -->
                    <PartGroup {parts} {zoomScale} />

                    <!-- Rapid layer -->
                    <RapidGroup {rapids} {zoomScale} />

                    <!-- Cut layer -->
                    <CutGroup {cuts} {zoomScale} />
                {/if}
            </g>
        </g>
    </svg>
</div>

<style>
    .svg-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    .drawing-svg {
        width: 100%;
        height: 100%;
        display: block;
        cursor: default;
    }

    .drawing-svg.panning {
        cursor: grabbing;
    }
</style>
