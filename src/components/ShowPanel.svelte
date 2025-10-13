<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { shapeVisualizationStore } from '$lib/stores/shape/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { showLeadNormals, showLeadPaths } from '$lib/stores/leads/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { rapidStore } from '$lib/stores/rapids/store';

    // Subscribe to the stores
    $: shapeVisualization = $shapeVisualizationStore;
    $: chainVisualization = $chainStore;
    $: cutsVisualization = $cutStore;
    $: rapidsVisualization = $rapidStore;

    function resetAll() {
        // Reset shape visualization
        shapeVisualizationStore.reset();

        // Reset chain visualization
        chainStore.setShowChainPaths(true);
        chainStore.setShowChainStartPoints(false);
        chainStore.setShowChainEndPoints(false);
        chainStore.setShowChainTangentLines(false);
        chainStore.setShowChainNormals(false);
        chainStore.setShowChainDirections(false);

        // Reset cut visualization
        cutStore.setShowCutNormals(false);
        cutStore.setShowCutDirections(false);
        cutStore.setShowCutPaths(true);
        cutStore.setShowCutter(false);
        cutStore.setShowCutStartPoints(false);
        cutStore.setShowCutEndPoints(false);

        // Reset lead visualization
        showLeadNormals.set(false);
        showLeadPaths.set(true);

        // Reset rapid visualization
        rapidStore.setShowRapids(true);
        rapidStore.setShowRapidDirections(false);
    }
</script>

<AccordionPanel title="Show" isExpanded={false}>
    <div class="show-panel-content">
        <div class="show-section">
            <h3 class="section-header">Shapes</h3>
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
                Directions
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
                Ends
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
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={shapeVisualization.showShapePaths}
                    onchange={(e) =>
                        shapeVisualizationStore.setShowShapePaths(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Paths
            </label>
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
                Starts
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
                Tangents
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Chains</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={chainVisualization.showChainDirections}
                    onchange={(e) =>
                        chainStore.setShowChainDirections(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Directions
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
                Ends
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={chainVisualization.showChainNormals}
                    onchange={(e) =>
                        chainStore.setShowChainNormals(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={chainVisualization.showChainPaths}
                    onchange={(e) =>
                        chainStore.setShowChainPaths(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Paths
            </label>
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
                Starts
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
                Tangents
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Cuts</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={cutsVisualization.showCutter}
                    onchange={(e) =>
                        cutStore.setShowCutter(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Cutter
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={cutsVisualization.showCutDirections}
                    onchange={(e) =>
                        cutStore.setShowCutDirections(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Directions
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={cutsVisualization.showCutEndPoints}
                    onchange={(e) =>
                        cutStore.setShowCutEndPoints(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Ends
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={cutsVisualization.showCutNormals}
                    onchange={(e) =>
                        cutStore.setShowCutNormals(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={cutsVisualization.showCutPaths}
                    onchange={(e) =>
                        cutStore.setShowCutPaths(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Paths
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={cutsVisualization.showCutStartPoints}
                    onchange={(e) =>
                        cutStore.setShowCutStartPoints(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Starts
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
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    bind:checked={$showLeadPaths}
                    class="show-checkbox"
                />
                Paths
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Rapids</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={rapidsVisualization.showRapidDirections}
                    onchange={(e) =>
                        rapidStore.setShowRapidDirections(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Directions
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={rapidsVisualization.showRapids}
                    onchange={(e) =>
                        rapidStore.setShowRapids(e.currentTarget.checked)}
                    class="show-checkbox"
                />
                Paths
            </label>
        </div>

        <div class="reset-button-container">
            <button class="reset-button" onclick={resetAll}> Reset All </button>
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
        flex-wrap: wrap;
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
    }

    .show-section:last-of-type {
        border-bottom: none;
        padding-bottom: 0;
    }

    .section-header {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
        flex-basis: 100%;
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

    .reset-button-container {
        display: flex;
        justify-content: flex-end;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
        margin-top: 0.5rem;
    }

    .reset-button {
        padding: 0.5rem 1rem;
        background-color: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .reset-button:hover {
        background-color: #e5e7eb;
        border-color: #9ca3af;
    }

    .reset-button:active {
        background-color: #d1d5db;
    }
</style>
