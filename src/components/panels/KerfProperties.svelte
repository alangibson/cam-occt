<script lang="ts">
    import { kerfStore } from '$lib/stores/kerfs/store';
    import { planStore } from '$lib/stores/plan/store';
    import { selectionStore } from '$lib/stores/selection/store';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive kerf data
    $: kerfs = $kerfStore.kerfs;
    $: selection = $selectionStore;
    $: selectedKerfId = selection.kerfs.selected;
    $: selectedKerf = selectedKerfId
        ? kerfs.find((kerf) => kerf.id === selectedKerfId)
        : null;

    // Get the associated cut for reference
    $: cuts = $planStore.plan.cuts;
    $: associatedCut =
        selectedKerf && cuts && cuts.length > 0
            ? cuts.find((cut) => cut.id === selectedKerf.cutId)
            : null;

    // Build properties array
    $: properties = selectedKerf
        ? (() => {
              const props: Array<{ property: string; value: string }> = [];

              // Type is always first
              props.push({
                  property: 'Type',
                  value: 'Kerf',
              });

              props.push({
                  property: 'Name',
                  value: selectedKerf.name,
              });

              props.push({
                  property: 'Enabled',
                  value: selectedKerf.enabled ? 'Yes' : 'No',
              });

              props.push({
                  property: 'Kerf Width',
                  value: `${selectedKerf.kerfWidth.toFixed(3)} units`,
              });

              props.push({
                  property: 'Status',
                  value: selectedKerf.isClosed ? 'Closed' : 'Open',
              });

              if (associatedCut) {
                  props.push({
                      property: 'Cut',
                      value: associatedCut.name,
                  });
              }

              props.push({
                  property: 'Cut ID',
                  value: selectedKerf.cutId,
              });

              props.push({
                  property: 'Inner Chain Shapes',
                  value: String(selectedKerf.innerChain.shapes.length),
              });

              props.push({
                  property: 'Outer Chain Shapes',
                  value: String(selectedKerf.outerChain.shapes.length),
              });

              props.push({
                  property: 'Lead-In',
                  value: selectedKerf.leadIn ? 'Present' : 'None',
              });

              props.push({
                  property: 'Lead-Out',
                  value: selectedKerf.leadOut ? 'Present' : 'None',
              });

              props.push({
                  property: 'Generated',
                  value: new Date(selectedKerf.generatedAt).toLocaleString(),
              });

              props.push({
                  property: 'Version',
                  value: String(selectedKerf.version),
              });

              return props;
          })()
        : [];

    async function copyKerfToClipboard() {
        if (!selectedKerf) return;

        try {
            const json = JSON.stringify(selectedKerf, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="kerf-properties">
    {#if selectedKerf}
        <InspectProperties {properties} onCopy={copyKerfToClipboard} />
    {:else}
        <p class="no-selection">No kerf selected</p>
    {/if}
</div>

<style>
    .kerf-properties {
        min-height: 200px;
    }

    .no-selection {
        color: #666;
        text-align: center;
        font-style: italic;
        padding: 2rem 1rem;
    }
</style>
