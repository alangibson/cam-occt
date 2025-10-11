<script lang="ts">
    import { settingsStore } from '$lib/stores/settings/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { getStageDisplayName } from '$lib/stores/workflow/functions';
    import { PreprocessingStep } from '$lib/stores/settings/interfaces';

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
</script>

<div class="settings-container">
    <h1>Settings</h1>

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
            </div>
        </section>
    </div>
</div>

<style>
    .settings-container {
        padding: 2rem;
        height: 100%;
        overflow: auto;
    }

    h1 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 1.5rem 0;
        color: #1f2937;
    }

    .settings-columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
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

    @media (max-width: 768px) {
        .settings-columns {
            grid-template-columns: 1fr;
        }
    }
</style>
