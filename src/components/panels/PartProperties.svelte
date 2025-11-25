<script lang="ts">
    import { partStore } from '$lib/stores/parts/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { detectCutDirection } from '$lib/cam/cut/cut-direction';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import { CutDirection } from '$lib/cam/cut/enums';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive part data
    $: detectedParts = $drawingStore.drawing
        ? Object.values($drawingStore.drawing.layers).flatMap(
              (layer) => layer.parts
          )
        : [];
    $: selectedPartIds = $partStore.selectedPartIds;
    $: selectedPartId =
        selectedPartIds.size === 1 ? Array.from(selectedPartIds)[0] : null;
    $: highlightedPartId = $partStore.highlightedPartId;
    $: hoveredPartId = $partStore.hoveredPartId;
    $: activePartId = selectedPartId || highlightedPartId || hoveredPartId;
    $: selectedPart = activePartId
        ? detectedParts.find((part) => part.id === activePartId)
        : null;
    $: algorithmParams = $prepareStageStore.algorithmParams;

    // Build properties array
    $: properties = selectedPart
        ? (() => {
              const props: Array<{ property: string; value: string }> = [];

              // Type is always first
              props.push({
                  property: 'Type',
                  value: 'Part',
              });

              props.push({
                  property: 'Name',
                  value: selectedPart.id,
              });

              props.push({
                  property: 'Shell Chain',
                  value: selectedPart.shell.id,
              });

              const direction = detectCutDirection(
                  selectedPart.shell,
                  algorithmParams.chainDetection.tolerance
              );
              props.push({
                  property: 'Shell Winding',
                  value:
                      direction === CutDirection.CLOCKWISE
                          ? 'CW'
                          : direction === CutDirection.COUNTERCLOCKWISE
                            ? 'CCW'
                            : 'N/A',
              });

              props.push({
                  property: 'Shell Shapes',
                  value: String(selectedPart.shell.shapes.length),
              });

              props.push({
                  property: 'Void Count',
                  value: String(selectedPart.voids.length),
              });

              return props;
          })()
        : [];

    async function copyPartToClipboard() {
        if (!selectedPart) return;

        try {
            const json = JSON.stringify(selectedPart, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="part-properties">
    {#if selectedPart}
        <InspectProperties {properties} onCopy={copyPartToClipboard} />
    {/if}
</div>

<style>
    .part-properties {
        min-height: 200px;
    }
</style>
