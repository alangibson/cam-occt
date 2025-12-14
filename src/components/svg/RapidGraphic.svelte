<script lang="ts">
    import type { Rapid } from '$lib/cam/rapid/interfaces';
    import { selectionStore } from '$lib/stores/selection/store.svelte';

    // Component props
    let {
        rapid,
        onclick,
        onmousemove,
    }: {
        rapid: Rapid;
        onclick?: (e: MouseEvent) => void;
        onmousemove?: (e: MouseEvent) => void;
    } = $props();

    // Selection state from stores
    const selectedRapidIds = $derived(selectionStore.rapids.selected);
    const highlightedRapidId = $derived(selectionStore.rapids.highlighted);

    // Get stroke color for a rapid based on selection/highlight state
    const strokeColor = $derived.by(() => {
        if (selectedRapidIds.has(rapid.id)) {
            return '#ff6600'; // Orange for selected
        }
        if (highlightedRapidId === rapid.id) {
            return '#ff6600'; // Orange for highlighted
        }
        return 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for normal
    });

    // Constant dash array - always the same regardless of state
    const dashArray = '5 5';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<g>
    <!-- Invisible hit area (8px wide) -->
    <line
        class="rapid"
        data-rapid-id={rapid.id}
        x1={rapid.start.x}
        y1={rapid.start.y}
        x2={rapid.end.x}
        y2={rapid.end.y}
        stroke={strokeColor}
        stroke-width="8"
        fill="none"
        vector-effect="non-scaling-stroke"
        style="opacity: 0; pointer-events: stroke;"
        role="button"
        tabindex="0"
        {onclick}
        {onmousemove}
    />
    <!-- Visible line (1px wide) -->
    <line
        class="rapid"
        data-rapid-id={rapid.id}
        x1={rapid.start.x}
        y1={rapid.start.y}
        x2={rapid.end.x}
        y2={rapid.end.y}
        stroke={strokeColor}
        stroke-width="1"
        stroke-dasharray={dashArray}
        fill="none"
        vector-effect="non-scaling-stroke"
        style="pointer-events: none;"
    />
</g>

<style>
    .rapid:focus {
        outline: none;
    }
</style>
