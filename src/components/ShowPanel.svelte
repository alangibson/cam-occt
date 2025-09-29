<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { shapeVisualizationStore } from '$lib/stores/shape/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { showLeadNormals } from '$lib/stores/leads';

    // Subscribe to the stores
    $: shapeVisualization = $shapeVisualizationStore;
    $: chainVisualization = $chainStore;
</script>

<AccordionPanel title="Show" isExpanded={true}>
    <div class="show-panel-content">
        <label class="show-checkbox-label">
            <input
                type="checkbox"
                checked={shapeVisualization.showShapeStartPoints}
                onchange={(e) =>
                    shapeVisualizationStore.setShowShapeStartPoints(
                        e.currentTarget.checked
                    )}
                class="show-checkbox"
            />
            Shape Start Points
        </label>
        <label class="show-checkbox-label">
            <input
                type="checkbox"
                checked={shapeVisualization.showShapeEndPoints}
                onchange={(e) =>
                    shapeVisualizationStore.setShowShapeEndPoints(
                        e.currentTarget.checked
                    )}
                class="show-checkbox"
            />
            Shape End Points
        </label>
        <label class="show-checkbox-label">
            <input
                type="checkbox"
                checked={chainVisualization.showChainStartPoints}
                onchange={(e) =>
                    chainStore.setShowChainStartPoints(e.currentTarget.checked)}
                class="show-checkbox"
            />
            Chain Start Points
        </label>
        <label class="show-checkbox-label">
            <input
                type="checkbox"
                checked={chainVisualization.showChainEndPoints}
                onchange={(e) =>
                    chainStore.setShowChainEndPoints(e.currentTarget.checked)}
                class="show-checkbox"
            />
            Chain End Points
        </label>
        <label class="show-checkbox-label">
            <input
                type="checkbox"
                checked={chainVisualization.showChainTangentLines}
                onchange={(e) =>
                    chainStore.setShowChainTangentLines(
                        e.currentTarget.checked
                    )}
                class="show-checkbox"
            />
            Chain Tangent Lines
        </label>
        <label class="show-checkbox-label">
            <input
                type="checkbox"
                bind:checked={$showLeadNormals}
                class="show-checkbox"
            />
            Lead Normal Lines
        </label>
    </div>
</AccordionPanel>

<style>
    .show-panel-content {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .show-checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
        user-select: none;
    }

    .show-checkbox {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
    }
</style>
