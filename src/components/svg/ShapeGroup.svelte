<script lang="ts">
    import { Shape } from '$lib/cam/shape/classes';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { SelectionMode } from '$lib/config/settings/enums';
    import ShapeGraphic from './ShapeGraphic.svelte';
    import StartPointGraphic from './StartPointGraphic.svelte';
    import EndPointGraphic from './EndPointGraphic.svelte';
    import TessellationGraphic from './TessellationGraphic.svelte';
    import TangentGraphic from './TangentGraphic.svelte';
    import DirectionArrowGraphic from './DirectionArrowGraphic.svelte';
    import NormalGraphic from './NormalGraphic.svelte';

    // Component props
    let {
        shapes = [],
        zoomScale,
    }: {
        shapes?: Shape[];
        zoomScale: number;
    } = $props();

    // Get unit scale for constant screen sizes
    const unitScale = $derived(drawingStore.unitScale);

    // Track when shapes prop changes
    $effect(() => {
        void shapes.length;
    });

    // Selection state from stores
    const selectedShapeIds = $derived(selectionStore.shapes.selected);
    const hoveredShapeId = $derived(selectionStore.shapes.hovered);

    // Get stroke color for a shape based on selection/hover state
    function getShapeStrokeColor(shapeId: string): string {
        if (selectedShapeIds.has(shapeId)) {
            return '#ff6600'; // Orange for selected
        }
        if (hoveredShapeId === shapeId) {
            return '#ff6600'; // Orange for hovered
        }
        return '#000000'; // Black for normal
    }

    // Shape mouse event handlers
    function handleShapeClick(e: MouseEvent) {
        // Check selection mode - only allow shape selection in Auto or Shape mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Shape
        ) {
            return;
        }

        // Get the shape ID from the clicked element
        // eslint-disable-next-line no-undef
        const target = e.target as SVGElement;
        const shapeId = target.getAttribute('data-shape-id');

        if (shapeId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            // Allow individual shape selection
            if (!e.ctrlKey && !selectedShapeIds.has(shapeId)) {
                selectionStore.clearShapeSelection();
            }
            selectionStore.selectShape(shapeId, e.ctrlKey);
        }
    }

    function handleShapeMouseMove(e: MouseEvent) {
        // Check selection mode - only allow shape selection in Auto or Shape mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Shape
        ) {
            return;
        }

        // Get the shape ID from the hovered element
        // eslint-disable-next-line no-undef
        const target = e.target as SVGElement;
        const shapeId = target?.getAttribute('data-shape-id');

        if (shapeId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            selectionStore.setHoveredShape(shapeId);
        }
    }
</script>

<g class="shapes">
    <!-- Shape paths -->
    {#if visualizationStore.showShapePaths}
        <g id="shapes">
            {#each shapes as shape (shape.id)}
                <ShapeGraphic
                    {shape}
                    stroke={getShapeStrokeColor(shape.id)}
                    onclick={handleShapeClick}
                    onmousemove={handleShapeMouseMove}
                />
            {/each}
        </g>
    {/if}

    <!-- Shape Start/End Points -->
    {#if visualizationStore.showShapeStartPoints || visualizationStore.showShapeEndPoints}
        <g id="shape-endpoints">
            {#each shapes as shape (shape.id)}
                {#if visualizationStore.showShapeStartPoints}
                    {@const startPoint = shape.startPoint}
                    <StartPointGraphic
                        point={startPoint}
                        {unitScale}
                        {zoomScale}
                    />
                {/if}
                {#if visualizationStore.showShapeEndPoints}
                    {@const endPoint = shape.endPoint}
                    <EndPointGraphic point={endPoint} {unitScale} {zoomScale} />
                {/if}
            {/each}
        </g>
    {/if}

    <!-- Shape Normals -->
    {#if visualizationStore.showShapeNormals}
        <g id="shape-normals">
            {#each shapes as shape (shape.id)}
                {@const midpoint = shape.midPoint}
                {@const normal = shape.normal}
                <NormalGraphic
                    startPoint={midpoint}
                    {normal}
                    {unitScale}
                    {zoomScale}
                />
            {/each}
        </g>
    {/if}

    <!-- Shape Winding Direction -->
    {#if visualizationStore.showShapeWindingDirection}
        <g id="shape-winding">
            {#each shapes as shape (shape.id)}
                {@const midpoint = shape.midPoint}
                {@const p1 = shape.pointAt(0.49)}
                {@const p2 = shape.pointAt(0.51)}
                {#if p1 && p2}
                    <DirectionArrowGraphic
                        {midpoint}
                        {p1}
                        {p2}
                        {unitScale}
                        {zoomScale}
                    />
                {/if}
            {/each}
        </g>
    {/if}

    <!-- Shape Tangent Lines -->
    {#if visualizationStore.showShapeTangentLines}
        <g id="shape-tangents">
            {#each shapes as shape (shape.id)}
                {@const midpoint = shape.midPoint}
                {@const p1 = shape.pointAt(0.49)}
                {@const p2 = shape.pointAt(0.51)}
                {#if p1 && p2}
                    {@const tangent = { x: p2.x - p1.x, y: p2.y - p1.y }}
                    <TangentGraphic
                        point={midpoint}
                        {tangent}
                        {unitScale}
                        {zoomScale}
                    />
                {/if}
            {/each}
        </g>
    {/if}

    <!-- Shape Tessellation -->
    {#if visualizationStore.showShapeTessellation}
        <g id="shape-tessellation">
            {#each shapes as shape (shape.id)}
                {@const tessellationPoints = shape.tessellated.points}
                <TessellationGraphic
                    points={tessellationPoints}
                    {unitScale}
                    {zoomScale}
                />
            {/each}
        </g>
    {/if}
</g>
