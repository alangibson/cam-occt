<script lang="ts">
    import type { Chain } from '$lib/cam/chain/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import ShapeGraphic from './ShapeGraphic.svelte';

    // Component props
    let {
        chain,
        onclick,
        onmousemove,
    }: {
        chain: Chain;
        onclick?: (e: MouseEvent) => void;
        onmousemove?: (e: MouseEvent) => void;
    } = $props();

    // Selection state from stores
    const selectedChainIds = $derived(selectionStore.chains.selected);
    const highlightedChainId = $derived(selectionStore.chains.highlighted);

    // Get stroke color for the chain based on selection/highlight state
    const strokeColor = $derived.by(() => {
        if (selectedChainIds.has(chain.id)) {
            return '#ff6600'; // Orange for selected
        }
        if (highlightedChainId === chain.id) {
            return '#ff6600'; // Orange for highlighted
        }
        return 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for normal
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<g
    class="chain"
    data-chain-id={chain.id}
    role="button"
    tabindex="0"
    {onclick}
    {onmousemove}
>
    {#each chain.shapes as shape (shape.id)}
        <ShapeGraphic
            {shape}
            stroke={strokeColor}
            {onclick}
            {onmousemove}
        />
    {/each}
</g>

<style>
    .chain:focus {
        outline: none;
    }
</style>
