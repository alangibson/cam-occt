<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store';
    import { selectionStore } from '$lib/stores/selection/store';
    import { detectCutDirection } from '$lib/cam/cut/cut-direction';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import { CutDirection } from '$lib/cam/cut/enums';
    import { Chain } from '$lib/cam/chain/classes';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive part data
    $: detectedParts = $drawingStore.drawing
        ? Object.values($drawingStore.drawing.layers).flatMap(
              (layer) => layer.parts
          )
        : [];
    $: selection = $selectionStore;
    $: selectedPartIds = selection.parts.selected;
    $: selectedPartId =
        selectedPartIds.size === 1 ? Array.from(selectedPartIds)[0] : null;
    $: highlightedPartId = selection.parts.highlighted;
    $: hoveredPartId = selection.parts.hovered;
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
                  value: selectedPart.name,
              });

              props.push({
                  property: 'Shell Chain',
                  value: selectedPart.shell.id,
              });

              const direction = detectCutDirection(
                  new Chain(selectedPart.shell),
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
            const data =
                typeof selectedPart.toData === 'function'
                    ? selectedPart.toData()
                    : selectedPart;
            const json = JSON.stringify(data, null, 2);
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
