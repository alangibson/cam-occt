<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { shapeVisualizationStore } from '$lib/stores/shape/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { showLeadNormals } from '$lib/stores/leads';
    import { cutStore } from '$lib/stores/cuts/store';

    // Subscribe to the stores
    $: shapeVisualization = $shapeVisualizationStore;
    $: chainVisualization = $chainStore;
    $: cutsVisualization = $cutStore;
</script>

<AccordionPanel title="Show" isExpanded={false}>
    <div class="show-panel-content">
        <div class="show-section">
            <h3 class="section-header">Shapes</h3>
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
                Start Points
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
                End Points
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={shapeVisualization.showShapeNormals}
                    onchange={(e) =>
                        shapeVisualizationStore.setShowShapeNormals(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Normal Lines
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={shapeVisualization.showShapeTangentLines}
                    onchange={(e) =>
                        shapeVisualizationStore.setShowShapeTangentLines(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tangent Lines
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={shapeVisualization.showShapeWindingDirection}
                    onchange={(e) =>
                        shapeVisualizationStore.setShowShapeWindingDirection(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Winding Direction
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Chains</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={chainVisualization.showChainStartPoints}
                    onchange={(e) =>
                        chainStore.setShowChainStartPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Start Points
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={chainVisualization.showChainEndPoints}
                    onchange={(e) =>
                        chainStore.setShowChainEndPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                End Points
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={chainVisualization.showChainNormals}
                    onchange={(e) =>
                        chainStore.setShowChainNormals(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Normal Lines
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
                Tangent Lines
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Cuts</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={cutsVisualization.showCutNormals}
                    onchange={(e) =>
                        cutStore.setShowCutNormals(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Normal Lines
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Leads</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    bind:checked={$showLeadNormals}
                    class="show-checkbox"
                />
                Normal Lines
            </label>
        </div>
    </div>
</AccordionPanel>

<style>
    .show-panel-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .show-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
    }

    .show-section:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .section-header {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
        margin-bottom: 0.25rem;
    }

    .show-checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
        user-select: none;
        padding-left: 0.25rem;
    }

    .show-checkbox-label:hover {
        color: #111827;
    }

    .show-checkbox {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        flex-shrink: 0;
    }
</style>
