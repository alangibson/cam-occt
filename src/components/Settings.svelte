<script lang="ts">
    import { settingsStore } from '$lib/stores/settings/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { getStageDisplayName } from '$lib/stores/workflow/functions';
    import {
        PreprocessingStep,
        OffsetImplementation,
    } from '$lib/stores/settings/interfaces';
    import { resetApplicationToDefaults } from '$lib/stores/storage/store';
    import { CutterCompensation } from '$lib/types/cam';

    const allStages = [
        WorkflowStage.IMPORT,
        WorkflowStage.EDIT,
        WorkflowStage.PREPARE,
        WorkflowStage.PROGRAM,
        WorkflowStage.SIMULATE,
        WorkflowStage.EXPORT,
    ];

    const allPreprocessingSteps = [
        PreprocessingStep.DecomposePolylines,
        PreprocessingStep.JoinColinearLines,
        PreprocessingStep.TranslateToPositive,
        PreprocessingStep.DetectChains,
        PreprocessingStep.NormalizeChains,
        PreprocessingStep.OptimizeStarts,
        PreprocessingStep.DetectParts,
    ];

    const preprocessingStepDisplayNames: Record<PreprocessingStep, string> = {
        [PreprocessingStep.DecomposePolylines]: 'Decompose Polylines',
        [PreprocessingStep.JoinColinearLines]: 'Join Co-linear Lines',
        [PreprocessingStep.TranslateToPositive]: 'Translate to Positive',
        [PreprocessingStep.DetectChains]: 'Detect Chains',
        [PreprocessingStep.NormalizeChains]: 'Normalize Chains',
        [PreprocessingStep.OptimizeStarts]: 'Optimize Starts',
        [PreprocessingStep.DetectParts]: 'Detect Parts',
    };

    function handleStageToggle(stage: WorkflowStage) {
        settingsStore.toggleStageEnabled(stage);
    }

    function isStageEnabled(stage: WorkflowStage): boolean {
        return $settingsStore.settings.enabledStages.includes(stage);
    }

    function handlePreprocessingStepToggle(step: PreprocessingStep) {
        settingsStore.togglePreprocessingStepEnabled(step);
    }

    function isPreprocessingStepEnabled(step: PreprocessingStep): boolean {
        return $settingsStore.settings.enabledPreprocessingSteps.includes(step);
    }

    function handleOffsetImplementationChange(
        implementation: OffsetImplementation
    ) {
        settingsStore.setOffsetImplementation(implementation);
    }

    function handleCutterCompensationChange(
        compensation: CutterCompensation | null
    ) {
        settingsStore.setCutterCompensation(compensation);
    }

    function handleResetApplication() {
        if (
            confirm(
                'Are you sure you want to reset the application? This will clear all data and settings.'
            )
        ) {
            resetApplicationToDefaults();
        }
    }

    function handleZoomToFitToggle() {
        settingsStore.setZoomToFit(
            !$settingsStore.settings.optimizationSettings.zoomToFit
        );
    }
</script>

<div class="settings-container">
    <div class="settings-header">
        <h1>Settings</h1>
        <button class="reset-button" onclick={handleResetApplication}>
            Reset Application
        </button>
    </div>

    <div class="settings-columns">
        <section class="settings-section">
            <h2>Workflow</h2>
            <div class="stages-list">
                {#each allStages as stage (stage)}
                    <label class="stage-item">
                        <input
                            type="checkbox"
                            checked={isStageEnabled(stage)}
                            disabled={stage === WorkflowStage.IMPORT}
                            onchange={() => handleStageToggle(stage)}
                        />
                        <span class="stage-name"
                            >{getStageDisplayName(stage)}</span
                        >
                    </label>
                {/each}
            </div>
        </section>

        <section class="settings-section">
            <h2>Preprogram</h2>
            <div class="stages-list">
                {#each allPreprocessingSteps as step (step)}
                    <label class="stage-item">
                        <input
                            type="checkbox"
                            checked={isPreprocessingStepEnabled(step)}
                            onchange={() => handlePreprocessingStepToggle(step)}
                        />
                        <span class="stage-name"
                            >{preprocessingStepDisplayNames[step]}</span
                        >
                    </label>
                {/each}
                <label class="stage-item">
                    <input
                        type="checkbox"
                        checked={$settingsStore.settings.optimizationSettings
                            .zoomToFit}
                        onchange={handleZoomToFitToggle}
                    />
                    <span class="stage-name">Zoom to Fit</span>
                </label>
            </div>
        </section>

        <section class="settings-section">
            <h2>Experimental</h2>
            <div class="stages-list">
                <div class="dropdown-container">
                    <label for="offsetImplementation" class="dropdown-label"
                        >Offset Calculation</label
                    >
                    <select
                        id="offsetImplementation"
                        class="dropdown-select"
                        value={$settingsStore.settings.offsetImplementation}
                        onchange={(e) =>
                            handleOffsetImplementationChange(
                                e.currentTarget.value as OffsetImplementation
                            )}
                    >
                        <option value={OffsetImplementation.Exact}>Exact</option
                        >
                        <option value={OffsetImplementation.Polyline}
                            >Polyline</option
                        >
                    </select>
                    {#if $settingsStore.settings.offsetImplementation === OffsetImplementation.Exact}
                        <span class="option-description"
                            >Preserves curves for smooth geometry</span
                        >
                    {:else if $settingsStore.settings.offsetImplementation === OffsetImplementation.Polyline}
                        <span class="option-description"
                            >Converts curves to straight line segments</span
                        >
                    {/if}
                </div>

                <div class="dropdown-container">
                    <label for="cutterCompensation" class="dropdown-label"
                        >Cutter Compensation</label
                    >
                    <select
                        id="cutterCompensation"
                        class="dropdown-select"
                        value={$settingsStore.settings.camSettings
                            .cutterCompensation === null
                            ? 'null'
                            : $settingsStore.settings.camSettings
                                  .cutterCompensation}
                        onchange={(e) => {
                            const value = e.currentTarget.value;
                            handleCutterCompensationChange(
                                value === 'null'
                                    ? null
                                    : (value as CutterCompensation)
                            );
                        }}
                    >
                        <option value={CutterCompensation.MACHINE}
                            >Machine</option
                        >
                        <option value={CutterCompensation.SOFTWARE}
                            >Software</option
                        >
                        <option value="null">No G-code</option>
                    </select>
                    {#if $settingsStore.settings.camSettings.cutterCompensation === CutterCompensation.MACHINE}
                        <span class="option-description"
                            >Machine handles cutter compensation (G41/G42)</span
                        >
                    {:else if $settingsStore.settings.camSettings.cutterCompensation === CutterCompensation.SOFTWARE}
                        <span class="option-description"
                            >Software offsets tool path by kerf width</span
                        >
                    {:else}
                        <span class="option-description"
                            >No cutter compensation in G-code</span
                        >
                    {/if}
                </div>
            </div>
        </section>
    </div>
</div>

<style>
    .settings-container {
        padding: 2rem;
        height: 100%;
        overflow: auto;
        position: relative;
    }

    .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    h1 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
        color: #1f2937;
    }

    .settings-columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
    }

    .settings-section {
        margin-bottom: 0;
    }

    h2 {
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0 0 1rem 0;
        color: #374151;
    }

    .stages-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .stage-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.375rem;
        transition: background-color 0.2s;
    }

    .stage-item:hover {
        background-color: #f3f4f6;
    }

    .stage-item input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        flex-shrink: 0;
    }

    .stage-item input[type='checkbox']:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .stage-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .option-description {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.2;
    }

    .dropdown-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .dropdown-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .dropdown-select {
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        color: #374151;
        background-color: white;
        cursor: pointer;
        transition: border-color 0.2s;
    }

    .dropdown-select:hover {
        border-color: #9ca3af;
    }

    .dropdown-select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .reset-button {
        background-color: #dc2626;
        color: white;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .reset-button:hover {
        background-color: #b91c1c;
    }

    .reset-button:active {
        background-color: #991b1b;
    }

    @media (max-width: 768px) {
        .settings-columns {
            grid-template-columns: 1fr;
        }
    }
</style>
