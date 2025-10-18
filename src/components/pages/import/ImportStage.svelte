<script lang="ts">
    import FileImport from './FileImport.svelte';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { overlayStore } from '$lib/stores/overlay/store';
    import { tessellationStore } from '$lib/stores/tessellation/store';
    import { settingsStore } from '$lib/stores/settings/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import {
        MeasurementSystem,
        ImportUnitSetting,
    } from '$lib/config/settings/enums';
    import { Unit } from '$lib/config/units/units';

    // Get current settings
    $: settings = $settingsStore.settings;

    async function handleFileImported(event: CustomEvent) {
        // Reset all application state when a new file is imported
        // This ensures clean state for the new drawing

        // Reset File Measurement Units to default (Automatic)
        settingsStore.setImportUnitSetting(ImportUnitSetting.Automatic);

        // Reset workflow state (except user settings)
        workflowStore.reset();

        // Clear all stage-specific data
        chainStore.clearChains();
        partStore.clearParts();
        overlayStore.clearAllOverlays();
        tessellationStore.clearTessellation();

        // Update import unit setting based on the file's original units
        const { originalUnits } = event.detail;
        if (originalUnits) {
            let newImportUnitSetting: ImportUnitSetting;

            if (originalUnits === Unit.INCH) {
                newImportUnitSetting = ImportUnitSetting.Imperial;
            } else if (originalUnits === Unit.MM) {
                newImportUnitSetting = ImportUnitSetting.Metric;
            } else if (originalUnits === Unit.NONE) {
                // No units specified in DXF file - set to Application
                newImportUnitSetting = ImportUnitSetting.Application;
            } else {
                // Unknown or unsupported unit system
                newImportUnitSetting = ImportUnitSetting.Application;
            }

            settingsStore.setImportUnitSetting(newImportUnitSetting);
        }

        // Mark import stage as complete
        workflowStore.completeStage(WorkflowStage.IMPORT);
    }

    function handleImportAdvance() {
        // Ensure units are never 'none' beyond import stage
        const drawing = $drawingStore.drawing;
        if (drawing && drawing.units === Unit.NONE) {
            // Convert 'none' units to concrete units based on application measurement system
            const targetUnit =
                settings.measurementSystem === MeasurementSystem.Metric
                    ? Unit.MM
                    : Unit.INCH;

            // Update the drawing with concrete units
            drawingStore.setDrawing(
                {
                    ...drawing,
                    units: targetUnit,
                },
                $drawingStore.fileName ?? undefined
            );
        }

        // Advance to next enabled stage when user clicks "Import >"
        const nextStage = workflowStore.getNextStage();
        if (nextStage) {
            workflowStore.setStage(nextStage);
        }
    }
</script>

<div class="import-stage">
    <div class="import-container">
        <div class="import-header">
            <h1>MetalHead CAM</h1>
        </div>

        <div class="import-content">
            <div class="file-import-section">
                <FileImport
                    on:fileImported={handleFileImported}
                    on:importAdvance={handleImportAdvance}
                />
            </div>

            <div class="settings-section">
                <div class="setting-group">
                    <label for="measurement-system"
                        >Application Measurement Units:</label
                    >
                    <select
                        id="measurement-system"
                        value={settings.measurementSystem}
                        on:change={(e) =>
                            settingsStore.setMeasurementSystem(
                                e.currentTarget.value as MeasurementSystem
                            )}
                    >
                        <option value="metric">Metric (mm)</option>
                        <option value="imperial">Imperial (in.)</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label for="import-unit-setting"
                        >File Measurement Units:</label
                    >
                    <select
                        id="import-unit-setting"
                        value={settings.importUnitSetting}
                        on:change={(e) =>
                            settingsStore.setImportUnitSetting(
                                e.currentTarget.value as ImportUnitSetting
                            )}
                    >
                        <option value="automatic"
                            >Automatic (use file's units)</option
                        >
                        <option value="application"
                            >Application Measurement Units</option
                        >
                        <option value="metric">Metric</option>
                        <option value="imperial">Imperial</option>
                    </select>
                </div>

                <div class="setting-info">
                    <p class="setting-note">
                        <strong>Application Measurement Units:</strong> Sets the
                        default unit system for the application.
                    </p>
                    <p class="setting-note">
                        <strong>File Measurement Units:</strong> Controls how file
                        units are handled during import. "Automatic" respects the
                        file's units, while other options convert to the selected
                        system.
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .import-stage {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 2rem;
        min-height: 100%;
        background-color: #f9fafb;
    }

    .import-container {
        max-width: 800px;
        width: 100%;
        background: white;
        border-radius: 0.75rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }

    .import-header {
        padding: 2rem 2rem 1rem;
        border-bottom: 1px solid #e5e7eb;
        text-align: center;
    }

    .import-header h1 {
        margin: 0 0 0.5rem 0;
        font-size: 2rem;
        font-weight: 700;
        color: #111827;
    }

    .import-content {
        padding: 2rem;
    }

    .settings-section {
        margin-top: 2rem;
        margin-bottom: 2rem;
        padding: 1.5rem;
        background-color: #f9fafb;
        border-radius: 0.5rem;
        border: 1px solid #e5e7eb;
    }

    .setting-group {
        margin-bottom: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .setting-group label {
        font-size: 0.9rem;
        font-weight: 500;
        color: #374151;
    }

    .setting-group select {
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.9rem;
        background-color: white;
        cursor: pointer;
    }

    .setting-group select:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.1);
    }

    .setting-info {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .setting-note {
        font-size: 0.8rem;
        color: #6b7280;
        margin: 0.5rem 0;
        line-height: 1.4;
    }

    /* Responsive design */
    @media (max-width: 768px) {
        .import-stage {
            padding: 1rem;
        }

        .import-header {
            padding: 1.5rem 1.5rem 1rem;
        }

        .import-header h1 {
            font-size: 1.75rem;
        }

        .import-content {
            padding: 1.5rem;
        }
    }
</style>
