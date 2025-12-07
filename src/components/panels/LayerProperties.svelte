<script lang="ts">
    import { layerStore } from '$lib/stores/layers/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive layer data
    const drawing = $derived(drawingStore.drawing);
    const layers = $derived(drawing ? Object.values(drawing.layers) : []);
    const selectedLayerId = $derived(layerStore.selectedLayerId);
    const highlightedLayerId = $derived(layerStore.highlightedLayerId);
    const activeLayerId = $derived(selectedLayerId || highlightedLayerId);
    const selectedLayer = $derived(
        activeLayerId
            ? layers.find((layer) => layer.name === activeLayerId)
            : null
    );

    // Build properties array
    const properties = $derived(
        selectedLayer
            ? (() => {
                  const props: Array<{ property: string; value: string }> = [];

                  // Type is always first
                  props.push({
                      property: 'Type',
                      value: 'Layer',
                  });

                  props.push({
                      property: 'Name',
                      value: selectedLayer.name,
                  });

                  props.push({
                      property: 'Shapes',
                      value: String(selectedLayer.shapes.length),
                  });

                  props.push({
                      property: 'Chains',
                      value: String(selectedLayer.chains.length),
                  });

                  props.push({
                      property: 'Parts',
                      value: String(selectedLayer.parts.length),
                  });

                  return props;
              })()
            : []
    );

    async function copyLayerToClipboard() {
        if (!selectedLayer) return;

        try {
            const layerData = selectedLayer.toData();
            const json = JSON.stringify(layerData, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="layer-properties">
    {#if selectedLayer}
        <InspectProperties {properties} onCopy={copyLayerToClipboard} />
    {/if}
</div>

<style>
    .layer-properties {
        min-height: 200px;
    }
</style>
