<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { settingsStore } from '$lib/stores/settings/store';
    import { RapidOptimizationAlgorithm } from '$lib/stores/settings/interfaces';

    // Reactive state
    $: optimizationSettings = $settingsStore.settings.optimizationSettings;

    function handleCutHolesFirstChange(event: Event) {
        const target = event.target as HTMLInputElement;
        settingsStore.setCutHolesFirst(target.checked);
    }

    function handleAlgorithmChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        settingsStore.setRapidOptimizationAlgorithm(
            target.value as RapidOptimizationAlgorithm
        );
    }
</script>

<AccordionPanel title="Optimize" isExpanded={false}>
    <div class="optimize-content">
        <div class="field-group">
            <label class="checkbox-label">
                <input
                    type="checkbox"
                    checked={optimizationSettings.cutHolesFirst}
                    onchange={handleCutHolesFirstChange}
                    class="checkbox-input"
                />
                Cut holes first
            </label>
        </div>

        <div class="field-group">
            <label for="rapid-optimization-algorithm" class="field-label"
                >Rapid Optimization:</label
            >
            <select
                id="rapid-optimization-algorithm"
                value={optimizationSettings.rapidOptimizationAlgorithm}
                onchange={handleAlgorithmChange}
                class="algorithm-select"
            >
                <option value={RapidOptimizationAlgorithm.None}>None</option>
                <option value={RapidOptimizationAlgorithm.TravelingSalesman}
                    >Traveling Salesman</option
                >
            </select>
        </div>
    </div>
</AccordionPanel>

<style>
    .optimize-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
    }

    .checkbox-input {
        margin: 0;
        cursor: pointer;
        transform: scale(1.1);
    }

    .field-label {
        font-size: 0.8rem;
        font-weight: 500;
        color: #374151;
    }

    .algorithm-select {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        background: white;
        cursor: pointer;
    }

    .algorithm-select:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .algorithm-select:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }
</style>
