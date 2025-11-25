<script lang="ts">
    import { rapidStore } from '$lib/stores/rapids/store';
    import { planStore } from '$lib/stores/plan/store';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive rapid data
    const rapidState = $derived($rapidStore);
    const cuts = $derived($planStore.plan.cuts);
    const rapids = $derived(
        cuts.map((cut) => cut.rapidIn).filter((rapid) => rapid !== undefined)
    );
    const selectedRapidIds = $derived(rapidState.selectedRapidIds);
    const selectedRapidId = $derived(
        selectedRapidIds.size === 1 ? Array.from(selectedRapidIds)[0] : null
    );
    const highlightedRapidId = $derived(rapidState.highlightedRapidId);
    const activeRapidId = $derived(selectedRapidId || highlightedRapidId);
    const selectedRapid = $derived(
        activeRapidId
            ? rapids.find((rapid) => rapid.id === activeRapidId)
            : null
    );

    // Calculate rapid distance
    function calculateDistance(
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Build properties array
    const properties = $derived(
        selectedRapid
            ? (() => {
                  const props: Array<{ property: string; value: string }> = [];

                  // Type is always first
                  props.push({
                      property: 'Type',
                      value: 'Rapid',
                  });

                  props.push({
                      property: 'ID',
                      value: selectedRapid.id,
                  });

                  props.push({
                      property: 'Start X',
                      value: selectedRapid.start.x.toFixed(3),
                  });

                  props.push({
                      property: 'Start Y',
                      value: selectedRapid.start.y.toFixed(3),
                  });

                  props.push({
                      property: 'End X',
                      value: selectedRapid.end.x.toFixed(3),
                  });

                  props.push({
                      property: 'End Y',
                      value: selectedRapid.end.y.toFixed(3),
                  });

                  props.push({
                      property: 'Distance',
                      value:
                          calculateDistance(
                              selectedRapid.start,
                              selectedRapid.end
                          ).toFixed(3) + ' units',
                  });

                  return props;
              })()
            : []
    );

    async function copyRapidToClipboard() {
        if (!selectedRapid) return;

        try {
            const json = JSON.stringify(selectedRapid, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="rapid-properties">
    {#if selectedRapid}
        <InspectProperties {properties} onCopy={copyRapidToClipboard} />
    {:else}
        <p class="no-selection">No rapid selected</p>
    {/if}
</div>

<style>
    .rapid-properties {
        min-height: 200px;
    }

    .no-selection {
        color: #666;
        font-style: italic;
        margin: 0;
        text-align: center;
        padding: 1rem;
    }
</style>
