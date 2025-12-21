<script lang="ts">
    import FileImport from './FileImport.svelte';
    import FileGallery from './FileGallery.svelte';
    import { workflowStore } from '$lib/stores/workflow/store.svelte';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { partStore } from '$lib/stores/parts/store.svelte';
    import { overlayStore } from '$lib/stores/overlay/store.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import {
        MeasurementSystem,
        ImportUnitSetting,
    } from '$lib/config/settings/enums';
    import { Unit } from '$lib/config/units/units';
    import type { DrawingData } from '$lib/cam/drawing/interfaces';
    import { applyAutoPreprocessing } from '$lib/cam/preprocess/auto-preprocess';

    // Get current settings
    let settings = $derived(settingsStore.settings);

    // State for external file loading from gallery
    let externalFileContent = $state<string | null>(null);
    let externalFileName = $state<string | null>(null);
    let autoAdvanceAfterImport = $state(false);

    async function handleFileImported(_detail: {
        drawing: DrawingData;
        fileName: string;
        originalUnits: Unit | null;
    }) {
        // Reset all application state when a new file is imported
        // This ensures clean state for the new drawing

        // Reset workflow state (except user settings)
        workflowStore.reset();

        // Clear all stage-specific data
        // Chains are auto-generated from drawing layers, no need to clear them
        partStore.clearParts();
        overlayStore.clearAllOverlays();
        visualizationStore.clearTessellation();

        // Apply preprocessing immediately after import to ensure drawing is preprocessed
        // before user can change settings (which would otherwise restore unprocessed state)
        await applyAutoPreprocessing();

        // Mark import stage as complete
        workflowStore.completeStage(WorkflowStage.IMPORT);

        // Auto-advance if this was loaded from the gallery
        if (autoAdvanceAfterImport) {
            const shouldAutoAdvance = autoAdvanceAfterImport;
            autoAdvanceAfterImport = false; // Reset flag
            await handleImportAdvance(shouldAutoAdvance);
        }
    }

    async function handleImportAdvance(fromAutoAdvance: boolean = false) {
        // Ensure units are never 'none' beyond import stage
        const drawing = drawingStore.drawing;
        if (drawing && drawing.units === Unit.NONE) {
            // Convert 'none' units to concrete units based on application measurement system
            const targetUnit =
                settings.measurementSystem === MeasurementSystem.Metric
                    ? Unit.MM
                    : Unit.INCH;

            // Update the drawing with concrete units
            drawing.units = targetUnit;
            drawingStore.setDrawing(drawing, drawing.fileName);
        }

        // Note: Preprocessing is already applied in handleFileImported() for gallery loads
        // For gallery loads (fromAutoAdvance=true), preprocessing was already done in handleFileImported()
        // For manual button clicks (fromAutoAdvance=false), we need to do it here
        if (!fromAutoAdvance) {
            // Only apply preprocessing if this is a manual advance (not auto-advance from gallery)
            await applyAutoPreprocessing();
        }

        // Mark import stage as complete before advancing
        workflowStore.completeStage(WorkflowStage.IMPORT);

        // Advance to Program stage (or next enabled stage if Program is disabled)
        // Always go to Program stage after importing, not to whatever the previous "next" stage was
        if (settings.enabledStages.includes(WorkflowStage.PROGRAM)) {
            workflowStore.setStage(WorkflowStage.PROGRAM);
        } else {
            // If Program is disabled, use getNextStage() as fallback
            const nextStage = workflowStore.getNextStage();
            if (nextStage) {
                workflowStore.setStage(nextStage);
            }
        }
    }

    async function handleFileSelect(path: string) {
        // Load the file from the gallery
        try {
            const response = await fetch(path);
            const fileContent = await response.text();
            const fileName = path.split('/').pop() || '';

            // Set flag to auto-advance after import
            autoAdvanceAfterImport = true;

            // Set the external file content and name to trigger FileImport processing
            externalFileContent = fileContent;
            externalFileName = fileName;

            // Reset after a brief moment to allow re-selection of same file
            setTimeout(() => {
                externalFileContent = null;
                externalFileName = null;
            }, 100);
        } catch (error) {
            console.error('Error loading file from gallery:', error);
            alert('Failed to load file from gallery');
        }
    }
</script>

<div class="import-stage">
    <!-- Row 1: Split in half -->
    <div class="row-1">
        <div class="left-cell">
            <div class="welcome-content">
                <h1 class="welcome-title">MetalHeadCAM</h1>
                <p class="welcome-tagline">
                    Free CAM for LinuxCNC Plasma Cutters
                </p>

                <div class="feature-list">
                    <div class="feature-item">
                        <div class="feature-icon">📐</div>
                        <div class="feature-text">
                            <h3>Import & Process</h3>
                            <p>
                                Load DXF and SVG files with automatic unit
                                conversion and geometry optimization
                            </p>
                        </div>
                    </div>

                    <div class="feature-item">
                        <div class="feature-icon">⚡</div>
                        <div class="feature-text">
                            <h3>Optimize Cuts</h3>
                            <p>
                                Advanced path planning with kerf compensation,
                                lead-in/lead-out, cut ordering, and rapid
                                minimization
                            </p>
                        </div>
                    </div>

                    <div class="feature-item">
                        <div class="feature-icon">🎬</div>
                        <div class="feature-text">
                            <h3>Simulate & Verify</h3>
                            <p>
                                Real-time cutting simulation with timeline
                                controls and visual verification
                            </p>
                        </div>
                    </div>

                    <div class="feature-item">
                        <div class="feature-icon">🔧</div>
                        <div class="feature-text">
                            <h3>Export G-code</h3>
                            <p>
                                Production-ready optimized G-code for LinuxCNC
                                plasma cutting
                            </p>
                        </div>
                    </div>
                </div>

                <div class="getting-started">
                    <h3>Getting Started</h3>
                    <p>
                        Import your design file using the file picker, or try
                        one of our example files below to explore MetalHeadCAM's
                        capabilities.
                    </p>
                </div>
            </div>
        </div>
        <div class="right-cell">
            <div class="import-container">
                <div class="import-content">
                    <div class="file-import-section">
                        <FileImport
                            onfileImported={handleFileImported}
                            onimportAdvance={handleImportAdvance}
                            {externalFileContent}
                            {externalFileName}
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
                                onchange={(e) =>
                                    settingsStore.setMeasurementSystem(
                                        e.currentTarget
                                            .value as MeasurementSystem
                                    )}
                            >
                                <option value="metric">Metric (mm)</option>
                                <option value="imperial">Imperial (in.)</option>
                            </select>
                            <p class="setting-description">
                                Sets the default unit system for the
                                application. All measurments will be in selected
                                unit.
                            </p>
                        </div>

                        <div class="setting-group">
                            <label for="import-unit-setting"
                                >File Measurement Units:</label
                            >
                            <select
                                id="import-unit-setting"
                                value={settings.importUnitSetting}
                                onchange={(e) =>
                                    settingsStore.setImportUnitSetting(
                                        e.currentTarget
                                            .value as ImportUnitSetting
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
                            <p class="setting-description">
                                Controls how file units are handled during
                                import. "Automatic" respects the file's units,
                                while other options convert to the selected
                                system.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Row 2: File gallery -->
    <div class="row-2">
        <FileGallery onfileSelect={handleFileSelect} />
    </div>
</div>

<style>
    .import-stage {
        display: grid;
        grid-template-rows: auto 1fr;
        min-height: 100%;
        background-color: #f9fafb;
        gap: 1rem;
        padding: 1rem;
    }

    /* Row 1: Split in half */
    .row-1 {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 1rem;
    }

    .left-cell {
        min-width: 0;
        display: flex;
        align-items: center;
    }

    .welcome-content {
        max-width: 600px;
        padding: 2rem;
    }

    .welcome-title {
        font-size: 3rem;
        font-weight: 700;
        color: rgb(0, 83, 135);
        margin: 0 0 0.5rem 0;
        line-height: 1.1;
    }

    .welcome-tagline {
        font-size: 1.25rem;
        color: #6b7280;
        margin: 0 0 2.5rem 0;
        line-height: 1.5;
    }

    .feature-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        margin-bottom: 2.5rem;
    }

    .feature-item {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
    }

    .feature-icon {
        font-size: 2rem;
        flex-shrink: 0;
        line-height: 1;
    }

    .feature-text h3 {
        font-size: 1.125rem;
        font-weight: 600;
        color: #111827;
        margin: 0 0 0.25rem 0;
    }

    .feature-text p {
        font-size: 0.9rem;
        color: #6b7280;
        margin: 0;
        line-height: 1.5;
    }

    .getting-started {
        padding: 1.5rem;
        background-color: #f0f9ff;
        border-left: 4px solid rgb(0, 83, 135);
        border-radius: 0.375rem;
    }

    .getting-started h3 {
        font-size: 1rem;
        font-weight: 600;
        color: rgb(0, 83, 135);
        margin: 0 0 0.5rem 0;
    }

    .getting-started p {
        font-size: 0.9rem;
        color: #374151;
        margin: 0;
        line-height: 1.6;
    }

    .right-cell {
        display: flex;
        justify-content: flex-end;
    }

    /* Row 2: Full width gallery */
    .row-2 {
        overflow: hidden;
    }

    .import-container {
        max-width: 800px;
        width: 100%;
        background: white;
        border-radius: 0.75rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }

    .import-content {
        padding: 2rem;
    }

    .settings-section {
        margin-top: 2rem;
        margin-bottom: 2rem;
        padding: 1.5rem 1.5rem 0;
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

    .setting-description {
        font-size: 0.8rem;
        color: #6b7280;
        margin: 0.25rem 0 0 0;
        line-height: 1.4;
    }

    /* Responsive design */
    @media (max-width: 768px) {
        .import-stage {
            padding: 0.5rem;
        }

        .row-1 {
            grid-template-columns: 1fr;
        }

        .left-cell {
            justify-content: center;
        }

        .welcome-content {
            padding: 1rem;
        }

        .welcome-title {
            font-size: 2rem;
        }

        .welcome-tagline {
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
        }

        .feature-list {
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .feature-icon {
            font-size: 1.5rem;
        }

        .getting-started {
            padding: 1rem;
        }

        .right-cell {
            justify-content: center;
        }

        .import-content {
            padding: 1.5rem;
        }
    }
</style>
