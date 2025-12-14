<script lang="ts">
    import type { Cut } from '$lib/cam/cut/classes.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import ShapeGraphic from './ShapeGraphic.svelte';
    import NormalGraphic from './NormalGraphic.svelte';
    import { Shape } from '$lib/cam/shape/classes';
    import { GeometryType } from '$lib/geometry/enums';

    // Component props
    let {
        cut,
        zoomScale,
        onclick,
        onmousemove,
    }: {
        cut: Cut;
        zoomScale: number;
        onclick?: (e: MouseEvent) => void;
        onmousemove?: (e: MouseEvent) => void;
    } = $props();

    // Get unit scale for constant screen sizes
    const unitScale = $derived(drawingStore.unitScale);

    // Selection state from stores
    const selectedLeadIds = $derived(selectionStore.leads.selected);
    const highlightedLeadId = $derived(selectionStore.leads.highlighted);

    // Get stroke color for lead-in based on selection/highlight state
    const leadInStrokeColor = $derived.by(() => {
        const leadInId = `${cut.id}-lead-in`;
        if (selectedLeadIds.has(leadInId)) {
            return '#ff6600'; // Orange for selected
        }
        if (highlightedLeadId === leadInId) {
            return '#ff6600'; // Orange for highlighted
        }
        return '#0000ff'; // Blue for normal
    });

    // Get stroke color for lead-out based on selection/highlight state
    const leadOutStrokeColor = $derived.by(() => {
        const leadOutId = `${cut.id}-lead-out`;
        if (selectedLeadIds.has(leadOutId)) {
            return '#ff6600'; // Orange for selected
        }
        if (highlightedLeadId === leadOutId) {
            return '#ff6600'; // Orange for highlighted
        }
        return '#ff0000'; // Red for normal
    });
</script>

<!-- Lead paths -->
{#if visualizationStore.showLeadPaths}
    <!-- Render lead-in geometry -->
    {#if cut.leadIn?.geometry}
        {@const leadShape = new Shape({
            id: `${cut.id}-lead-in`,
            type: GeometryType.ARC,
            geometry: cut.leadIn.geometry,
        })}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
            class="lead lead-in"
            data-lead-id="{cut.id}-lead-in"
            data-cut-id={cut.id}
            role="button"
            tabindex="0"
            {onclick}
            {onmousemove}
        >
            <ShapeGraphic
                shape={leadShape}
                stroke={leadInStrokeColor}
                {onclick}
                {onmousemove}
            />
        </g>
    {/if}

    <!-- Render lead-out geometry -->
    {#if cut.leadOut?.geometry}
        {@const leadShape = new Shape({
            id: `${cut.id}-lead-out`,
            type: GeometryType.ARC,
            geometry: cut.leadOut.geometry,
        })}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
            class="lead lead-out"
            data-lead-id="{cut.id}-lead-out"
            data-cut-id={cut.id}
            role="button"
            tabindex="0"
            {onclick}
            {onmousemove}
        >
            <ShapeGraphic
                shape={leadShape}
                stroke={leadOutStrokeColor}
                {onclick}
                {onmousemove}
            />
        </g>
    {/if}
{/if}

<!-- Lead normals -->
{#if visualizationStore.showLeadNormals}
    <!-- Lead-in normal -->
    {#if cut.leadIn?.normal && cut.leadIn?.connectionPoint}
        {@const startPoint = cut.leadIn.connectionPoint}
        {@const normal = cut.leadIn.normal}
        <NormalGraphic {startPoint} {normal} {unitScale} {zoomScale} />
    {/if}

    <!-- Lead-out normal -->
    {#if cut.leadOut?.normal && cut.leadOut?.connectionPoint}
        {@const startPoint = cut.leadOut.connectionPoint}
        {@const normal = cut.leadOut.normal}
        <NormalGraphic {startPoint} {normal} {unitScale} {zoomScale} />
    {/if}
{/if}

<style>
    .lead:focus {
        outline: none;
    }
</style>
