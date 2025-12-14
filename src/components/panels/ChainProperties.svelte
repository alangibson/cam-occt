<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { planStore } from '$lib/stores/plan/store.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { isChainClosed } from '$lib/cam/chain/functions';
    import { detectCutDirection } from '$lib/cam/cut/cut-direction';
    import { CutDirection } from '$lib/cam/cut/enums';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive chain and analysis data
    const drawing = $derived(drawingStore.drawing);
    const cuts = $derived(planStore.plan.cuts);

    // Get chains from both drawing layers and cut chains
    const detectedChains = $derived(
        (() => {
            const chains = drawing
                ? Object.values(drawing.layers).flatMap((layer) => layer.chains)
                : [];

            // Also include cutChains from cuts (which may have kerf compensation)
            const cutChains = cuts
                .map((cut) => cut.chain)
                .filter((chain) => chain !== undefined);

            // Combine and deduplicate by ID
            const allChains = [...chains, ...cutChains];
            const uniqueChains = Array.from(
                new Map(allChains.map((chain) => [chain.id, chain])).values()
            );

            return uniqueChains;
        })()
    );
    const selectedChainIds = $derived(selectionStore.chains.selected);
    const selectedChainId = $derived(
        selectedChainIds.size === 1 ? Array.from(selectedChainIds)[0] : null
    );
    const highlightedChainId = $derived(selectionStore.chains.highlighted);
    const activeChainId = $derived(selectedChainId || highlightedChainId);
    const selectedChain = $derived(
        activeChainId
            ? detectedChains.find((chain) => {
                  return chain.id === activeChainId;
              })
            : null
    );

    $effect(() => {
        void activeChainId;
        void selectedChain;
        void detectedChains;
    });

    // Build properties array
    const properties = $derived(
        selectedChain
            ? (() => {
                  const props: Array<{ property: string; value: string }> = [];

                  // Type is always first
                  props.push({
                      property: 'Type',
                      value: 'Chain',
                  });

                  props.push({
                      property: 'Name',
                      value: selectedChain.name,
                  });

                  props.push({
                      property: 'Status',
                      value: isChainClosed(selectedChain, 0.05)
                          ? 'Closed'
                          : 'Open',
                  });

                  props.push({
                      property: 'Cyclic',
                      value: selectedChain.isCyclic() ? 'Yes' : 'No',
                  });

                  const direction = detectCutDirection(selectedChain, 0.05);
                  props.push({
                      property: 'Winding',
                      value:
                          direction === CutDirection.CLOCKWISE
                              ? 'CW'
                              : direction === CutDirection.COUNTERCLOCKWISE
                                ? 'CCW'
                                : 'N/A',
                  });

                  return props;
              })()
            : []
    );

    async function copyChainToClipboard() {
        if (!selectedChain) return;

        try {
            const dataToSerialize = selectedChain.toData();
            const json = JSON.stringify(dataToSerialize, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy chain to clipboard:', err);
        }
    }
</script>

<div class="chain-properties">
    {#if selectedChain}
        <InspectProperties {properties} onCopy={copyChainToClipboard} />
    {/if}
</div>

<style>
    .chain-properties {
        min-height: 200px;
    }
</style>
