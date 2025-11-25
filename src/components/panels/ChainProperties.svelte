<script lang="ts">
    import { chainStore } from '$lib/stores/chains/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import { planStore } from '$lib/stores/plan/store';
    import { isChainClosed } from '$lib/cam/chain/functions';
    import { detectCutDirection } from '$lib/cam/cut/cut-direction';
    import { CutDirection } from '$lib/cam/cut/enums';
    import InspectProperties from './InspectProperties.svelte';

    // Reactive chain and analysis data
    const drawing = $derived($drawingStore.drawing);
    const cuts = $derived($planStore.plan.cuts);

    // Get chains from both drawing layers and cut chains
    const detectedChains = $derived(
        (() => {
            const chains = drawing
                ? Object.values(drawing.layers).flatMap((layer) => layer.chains)
                : [];

            // Also include cutChains from cuts (which may have kerf compensation)
            const cutChains = cuts
                .map((cut) => cut.cutChain)
                .filter((chain) => chain !== undefined);

            // Combine and deduplicate by ID
            const allChains = [...chains, ...cutChains];
            const uniqueChains = Array.from(
                new Map(allChains.map((chain) => [chain.id, chain])).values()
            );

            return uniqueChains;
        })()
    );
    const selectedChainIds = $derived($chainStore.selectedChainIds);
    const selectedChainId = $derived(
        selectedChainIds.size === 1 ? Array.from(selectedChainIds)[0] : null
    );
    const highlightedChainId = $derived($chainStore.highlightedChainId);
    const activeChainId = $derived(selectedChainId || highlightedChainId);
    const selectedChain = $derived(
        activeChainId
            ? detectedChains.find((chain) => {
                  console.log(
                      '[ChainProperties] Looking for chain:',
                      activeChainId,
                      'current:',
                      chain.id
                  );
                  return chain.id === activeChainId;
              })
            : null
    );

    $effect(() => {
        console.log(
            '[ChainProperties] activeChainId:',
            activeChainId,
            'selectedChain:',
            selectedChain?.id,
            'detectedChains:',
            detectedChains.map((c) => c.id),
            'selectedChainAnalysis:',
            selectedChainAnalysis
        );
    });
    const chainNormalizationResults = $derived(
        $prepareStageStore.chainNormalizationResults
    );
    const selectedChainAnalysis = $derived(
        activeChainId
            ? chainNormalizationResults.find(
                  (result) => result.chainId === activeChainId
              )
            : null
    );
    const algorithmParams = $derived($prepareStageStore.algorithmParams);

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
                      value: selectedChain.id,
                  });

                  if (selectedChainAnalysis) {
                      props.push({
                          property: 'Traversable',
                          value: selectedChainAnalysis.canTraverse
                              ? 'Yes'
                              : 'No',
                      });
                  }

                  props.push({
                      property: 'Status',
                      value: isChainClosed(
                          selectedChain,
                          algorithmParams.chainDetection.tolerance
                      )
                          ? 'Closed'
                          : 'Open',
                  });

                  const direction = detectCutDirection(
                      selectedChain,
                      algorithmParams.chainDetection.tolerance
                  );
                  props.push({
                      property: 'Winding',
                      value:
                          direction === CutDirection.CLOCKWISE
                              ? 'CW'
                              : direction === CutDirection.COUNTERCLOCKWISE
                                ? 'CCW'
                                : 'N/A',
                  });

                  if (selectedChainAnalysis) {
                      props.push({
                          property: 'Issues',
                          value: String(selectedChainAnalysis.issues.length),
                      });
                  }

                  return props;
              })()
            : []
    );

    async function copyChainToClipboard() {
        if (!selectedChain) return;

        try {
            const json = JSON.stringify(selectedChain, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="chain-properties">
    {#if selectedChain}
        <InspectProperties {properties} onCopy={copyChainToClipboard}>
            {#if selectedChainAnalysis && selectedChainAnalysis.issues.length > 0}
                <div class="chain-issues">
                    <h4 class="issues-title">Issues:</h4>
                    {#each selectedChainAnalysis.issues as issue, issueIndex (issueIndex)}
                        <div class="issue-item">
                            <span class="issue-type"
                                >{issue.type.replace('_', ' ')}</span
                            >
                            <span class="issue-description"
                                >{issue.description}</span
                            >
                        </div>
                    {/each}
                </div>
            {/if}
        </InspectProperties>
    {/if}
</div>

<style>
    .chain-properties {
        min-height: 200px;
    }

    .issues-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.5rem 0;
    }

    .chain-issues {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.375rem;
        padding: 0.75rem;
        margin-top: 1rem;
    }

    .issue-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.5rem;
    }

    .issue-item:last-child {
        margin-bottom: 0;
    }

    .issue-type {
        font-size: 0.75rem;
        font-weight: 600;
        color: rgb(133, 18, 0);
        text-transform: capitalize;
    }

    .issue-description {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.4;
    }
</style>
