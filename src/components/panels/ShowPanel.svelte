<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';

    function resetAll() {
        visualizationStore.reset();
    }
</script>

<AccordionPanel title="Show" isExpanded={false}>
    <div class="show-panel-content">
        <div class="show-section">
            <h3 class="section-header">Shapes</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showShapeWindingDirection}
                    onchange={(e) =>
                        visualizationStore.setShowShapeWindingDirection(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Directions
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showShapeEndPoints}
                    onchange={(e) =>
                        visualizationStore.setShowShapeEndPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Ends
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showShapeNormals}
                    onchange={(e) =>
                        visualizationStore.setShowShapeNormals(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showShapePaths}
                    onchange={(e) =>
                        visualizationStore.setShowShapePaths(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Paths
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showShapeStartPoints}
                    onchange={(e) =>
                        visualizationStore.setShowShapeStartPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Starts
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showShapeTangentLines}
                    onchange={(e) =>
                        visualizationStore.setShowShapeTangentLines(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tangents
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showShapeTessellation}
                    onchange={(e) =>
                        visualizationStore.setShowShapeTessellation(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tessellation
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Chains</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showChainDirections}
                    onchange={(e) =>
                        visualizationStore.setShowChainDirections(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Directions
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showChainEndPoints}
                    onchange={(e) =>
                        visualizationStore.setShowChainEndPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Ends
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showChainNormals}
                    onchange={(e) =>
                        visualizationStore.setShowChainNormals(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showChainPaths}
                    onchange={(e) =>
                        visualizationStore.setShowChainPaths(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Paths
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showChainStartPoints}
                    onchange={(e) =>
                        visualizationStore.setShowChainStartPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Starts
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showChainTangentLines}
                    onchange={(e) =>
                        visualizationStore.setShowChainTangentLines(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tangents
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showChainTessellation}
                    onchange={(e) =>
                        visualizationStore.setShowChainTessellation(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tessellation
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Parts</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartDirections}
                    onchange={(e) =>
                        visualizationStore.setShowPartDirections(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Directions
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartEndPoints}
                    onchange={(e) =>
                        visualizationStore.setShowPartEndPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Ends
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartNormals}
                    onchange={(e) =>
                        visualizationStore.setShowPartNormals(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartPaths}
                    onchange={(e) =>
                        visualizationStore.setShowPartPaths(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Paths
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartStartPoints}
                    onchange={(e) =>
                        visualizationStore.setShowPartStartPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Starts
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartTangentLines}
                    onchange={(e) =>
                        visualizationStore.setShowPartTangentLines(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tangents
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartTessellation}
                    onchange={(e) =>
                        visualizationStore.setShowPartTessellation(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tessellation
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showPartSurface}
                    onchange={(e) =>
                        visualizationStore.setShowPartSurface(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Surface
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Cuts</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showCutDirections}
                    onchange={(e) =>
                        visualizationStore.setShowCutDirections(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Directions
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showCutEndPoints}
                    onchange={(e) =>
                        visualizationStore.setShowCutEndPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Ends
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showCutNormals}
                    onchange={(e) =>
                        visualizationStore.setShowCutNormals(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showCutPaths}
                    onchange={(e) =>
                        visualizationStore.setShowCutPaths(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Paths
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showCutStartPoints}
                    onchange={(e) =>
                        visualizationStore.setShowCutStartPoints(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Starts
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showCutTangentLines}
                    onchange={(e) =>
                        visualizationStore.setShowCutTangentLines(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Tangents
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Leads</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    bind:checked={visualizationStore.showLeadKerfs}
                    class="show-checkbox"
                />
                Kerf
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    bind:checked={visualizationStore.showLeadNormals}
                    class="show-checkbox"
                />
                Normals
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    bind:checked={visualizationStore.showLeadPaths}
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
                    checked={visualizationStore.showRapidDirections}
                    onchange={(e) =>
                        visualizationStore.setShowRapidDirections(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Directions
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showRapids}
                    onchange={(e) =>
                        visualizationStore.setShowRapids(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Paths
            </label>
        </div>

        <div class="show-section">
            <h3 class="section-header">Kerfs</h3>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showCutter}
                    onchange={(e) =>
                        visualizationStore.setShowCutter(
                            e.currentTarget.checked
                        )}
                    class="show-checkbox"
                />
                Cutter
            </label>
            <label class="show-checkbox-label">
                <input
                    type="checkbox"
                    checked={visualizationStore.showKerfPaths}
                    onchange={(e) =>
                        visualizationStore.setShowKerfPaths(
                            e.currentTarget.checked
                        )}
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
