<script lang="ts">
    import { planStore } from '$lib/stores/plan/store.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { operationsStore } from '$lib/stores/operations/store.svelte';
    import { CutDirection } from '$lib/cam/cut/enums';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive cut data
    let cuts = $derived(planStore.plan.cuts);
    let selectedCutIds = $derived(selectionStore.cuts.selected);
    let selectedCutId = $derived(
        selectedCutIds.size === 1 ? Array.from(selectedCutIds)[0] : null
    );
    let highlightedCutId = $derived(selectionStore.cuts.highlighted);
    let activeCutId = $derived(selectedCutId || highlightedCutId);
    let selectedCut = $derived(
        activeCutId ? cuts.find((cut) => cut.id === activeCutId) : null
    );
    let operations = $derived(operationsStore.operations);
    let selectedOperation = $derived(
        selectedCut && operations && operations.length > 0
            ? operations.find((op) => op.id === selectedCut.sourceOperationId)
            : null
    );

    function getCutDirectionLabel(direction: CutDirection): string {
        switch (direction) {
            case CutDirection.CLOCKWISE:
                return 'Clockwise (CW)';
            case CutDirection.COUNTERCLOCKWISE:
                return 'Counter-clockwise (CCW)';
            default:
                return 'Unknown';
        }
    }

    function getLeadConfigLabel(
        config: { type: string; length?: number } | undefined
    ): string {
        if (!config) return 'None';
        return `${config.type.charAt(0).toUpperCase() + config.type.slice(1)}${config.length ? ` (${config.length.toFixed(2)})` : ''}`;
    }

    // Build properties array
    let properties = $derived(
        selectedCut
            ? (() => {
                  const props: Array<{ property: string; value: string }> = [];

                  // Type is always first
                  props.push({
                      property: 'Type',
                      value: 'Cut',
                  });

                  props.push({
                      property: 'Name',
                      value: selectedCut.name,
                  });

                  props.push({
                      property: 'Enabled',
                      value: selectedCut.enabled ? 'Yes' : 'No',
                  });

                  props.push({
                      property: 'Order',
                      value: String(selectedCut.order),
                  });

                  if (selectedOperation) {
                      props.push({
                          property: 'Operation',
                          value: selectedOperation.name,
                      });
                  }

                  props.push({
                      property: 'Chain ID',
                      value: selectedCut.sourceChainId,
                  });

                  props.push({
                      property: 'Cut Direction',
                      value: getCutDirectionLabel(selectedCut.direction),
                  });

                  if (selectedCut.isHole !== undefined) {
                      props.push({
                          property: 'Is Hole',
                          value: selectedCut.isHole ? 'Yes' : 'No',
                      });
                  }

                  if (selectedCut.holeUnderspeedPercent !== undefined) {
                      props.push({
                          property: 'Hole Speed',
                          value: `${selectedCut.holeUnderspeedPercent}%`,
                      });
                  }

                  if (selectedCut.feedRate !== undefined) {
                      props.push({
                          property: 'Feed Rate',
                          value: String(selectedCut.feedRate),
                      });
                  }

                  if (selectedCut.kerfWidth !== undefined) {
                      props.push({
                          property: 'Kerf Width',
                          value: selectedCut.kerfWidth.toFixed(3),
                      });
                  }

                  if (selectedCut.kerfCompensation !== undefined) {
                      props.push({
                          property: 'Kerf Comp',
                          value: selectedCut.kerfCompensation,
                      });
                  }

                  if (selectedCut.leadInConfig) {
                      props.push({
                          property: 'Lead In',
                          value: getLeadConfigLabel(selectedCut.leadInConfig),
                      });
                  }

                  if (selectedCut.leadOutConfig) {
                      props.push({
                          property: 'Lead Out',
                          value: getLeadConfigLabel(selectedCut.leadOutConfig),
                      });
                  }

                  if (selectedCut.pierceHeight !== undefined) {
                      props.push({
                          property: 'Pierce Height',
                          value: selectedCut.pierceHeight.toFixed(2),
                      });
                  }

                  if (selectedCut.pierceDelay !== undefined) {
                      props.push({
                          property: 'Pierce Delay',
                          value: `${selectedCut.pierceDelay.toFixed(2)}s`,
                      });
                  }

                  return props;
              })()
            : []
    );

    async function copyCutToClipboard() {
        if (!selectedCut) return;

        try {
            const data =
                typeof selectedCut.toData === 'function'
                    ? selectedCut.toData()
                    : selectedCut;
            const json = JSON.stringify(data, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="cut-properties">
    {#if selectedCut}
        <InspectProperties {properties} onCopy={copyCutToClipboard} />
    {/if}
</div>

<style>
    .cut-properties {
        min-height: 200px;
    }
</style>
