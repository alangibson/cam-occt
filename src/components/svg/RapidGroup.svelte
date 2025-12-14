<script lang="ts">
    import type { Rapid } from '$lib/cam/rapid/interfaces';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { SelectionMode } from '$lib/config/settings/enums';
    import RapidGraphic from './RapidGraphic.svelte';
    import DirectionArrowGraphic from './DirectionArrowGraphic.svelte';

    // Component props
    let {
        rapids = [],
        zoomScale,
    }: {
        rapids?: Rapid[];
        zoomScale: number;
    } = $props();

    // Get unit scale for constant screen sizes
    const unitScale = $derived(drawingStore.unitScale);

    // Selection state from stores
    const selectedRapidIds = $derived(selectionStore.rapids.selected);

    // Rapid mouse event handlers
    function handleRapidClick(e: MouseEvent) {
        // Check selection mode - only allow rapid selection in Auto or Rapid mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Rapid
        ) {
            return;
        }

        // Get the rapid ID from the clicked element or its parent
        const target = e.target as SVGElement;
        const rapidElement = target.closest('[data-rapid-id]');
        const rapidId = rapidElement?.getAttribute('data-rapid-id');

        if (rapidId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            // Allow individual rapid selection
            if (e.ctrlKey || e.metaKey) {
                // Multi-select mode: toggle rapid selection
                selectionStore.toggleRapidSelection(rapidId);
            } else {
                // Single select mode: clear others and select this one
                if (!selectedRapidIds.has(rapidId)) {
                    selectionStore.clearRapidSelection();
                }
                selectionStore.selectRapids(new Set([rapidId]));
            }
        }
    }

    function handleRapidMouseMove(e: MouseEvent) {
        // Check selection mode - only allow rapid selection in Auto or Rapid mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Rapid
        ) {
            return;
        }

        // Get the rapid ID from the hovered element or its parent
        const target = e.target as SVGElement;
        const rapidElement = target?.closest('[data-rapid-id]');
        const rapidId = rapidElement?.getAttribute('data-rapid-id');

        if (rapidId) {
            // Stop propagation to prevent triggering background handler
            e.stopPropagation();

            selectionStore.highlightRapid(rapidId);
        } else {
            selectionStore.highlightRapid(null);
        }
    }
</script>

<g class="rapids">
    <!-- Rapid paths -->
    {#if visualizationStore.showRapids}
        <g id="rapids">
            {#each rapids as rapid (rapid.id)}
                <RapidGraphic
                    {rapid}
                    onclick={handleRapidClick}
                    onmousemove={handleRapidMouseMove}
                />
            {/each}
        </g>
    {/if}

    <!-- Rapid Direction Indicators -->
    {#if visualizationStore.showRapidDirections}
        <g id="rapid-directions">
            {#each rapids as rapid (rapid.id)}
                {@const midpoint = {
                    x: (rapid.start.x + rapid.end.x) / 2,
                    y: (rapid.start.y + rapid.end.y) / 2,
                }}
                {@const p1 = rapid.start}
                {@const p2 = rapid.end}
                <DirectionArrowGraphic
                    {midpoint}
                    {p1}
                    {p2}
                    {unitScale}
                    {zoomScale}
                />
            {/each}
        </g>
    {/if}
</g>
