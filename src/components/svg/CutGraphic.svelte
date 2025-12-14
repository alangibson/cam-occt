<script lang="ts">
    import type { Cut } from '$lib/cam/cut/classes.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import ShapeGraphic from './ShapeGraphic.svelte';

    // Component props
    let {
        cut,
        onclick,
        onmousemove,
    }: {
        cut: Cut;
        onclick?: (e: MouseEvent) => void;
        onmousemove?: (e: MouseEvent) => void;
    } = $props();

    // Selection state from stores
    const selectedCutIds = $derived(selectionStore.cuts.selected);
    const highlightedCutId = $derived(selectionStore.cuts.highlighted);

    // Get stroke color for a cut based on selection/highlight state
    const strokeColor = $derived.by(() => {
        if (selectedCutIds.has(cut.id)) {
            return '#ff6600'; // Orange for selected
        }
        if (highlightedCutId === cut.id) {
            return '#ff6600'; // Orange for highlighted
        }
        return 'rgb(0, 133, 84)'; // Dark green for normal (matches DrawingCanvas)
    });
</script>

{#if visualizationStore.showCutPaths}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <g
        class="cut"
        data-cut-id={cut.id}
        role="button"
        tabindex="0"
        {onclick}
        {onmousemove}
    >
        <!-- Render offset shapes if available, otherwise render chain shapes -->
        {#if cut.offset?.offsetShapes && cut.offset.offsetShapes.length > 0}
            {#each cut.offset.offsetShapes as shape (shape.id)}
                <ShapeGraphic
                    {shape}
                    stroke={strokeColor}
                    {onclick}
                    {onmousemove}
                />
            {/each}
        {:else if cut.chain?.shapes && cut.chain.shapes.length > 0}
            {#each cut.chain.shapes as shape (shape.id)}
                <ShapeGraphic
                    {shape}
                    stroke={strokeColor}
                    {onclick}
                    {onmousemove}
                />
            {/each}
        {/if}
    </g>
{/if}

<style>
    .cut:focus {
        outline: none;
    }
</style>
