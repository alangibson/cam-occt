<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { settingsStore } from '$lib/stores/settings/store';
    import { MeasurementSystem } from '$lib/config/settings/enums';

    // Get rapid rate from settings store (stored in measurement system units)
    $: rapidRate = $settingsStore.settings.camSettings.rapidRate;
    $: measurementSystem = $settingsStore.settings.measurementSystem;

    // Display unit based on measurement system
    $: unit = measurementSystem === MeasurementSystem.Metric ? 'mm' : 'in';

    function handleRapidRateChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = parseFloat(target.value);
        if (!isNaN(value) && value > 0) {
            settingsStore.setRapidRate(value);
        }
    }

    function handleRapidRateBlur(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = parseFloat(target.value);
        if (isNaN(value) || value <= 0) {
            target.value = rapidRate.toString();
        }
    }
</script>

<AccordionPanel title="Machine" isExpanded={true}>
    <div class="simulate-content">
        <div class="field-group">
            <label for="rapid-rate" class="field-label">
                Rapid Feed Rate ({unit}/min):
            </label>
            <input
                id="rapid-rate"
                type="number"
                value={rapidRate}
                oninput={handleRapidRateChange}
                onblur={handleRapidRateBlur}
                min="0"
                step="100"
                class="rate-input"
            />
        </div>
    </div>
</AccordionPanel>

<style>
    .simulate-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .field-label {
        font-size: 0.8rem;
        font-weight: 500;
        color: #374151;
    }

    .rate-input {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        background: white;
    }

    .rate-input:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .rate-input:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }

    /* Remove spinner arrows for number input */
    .rate-input::-webkit-outer-spin-button,
    .rate-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .rate-input[type='number'] {
        appearance: textfield;
        -moz-appearance: textfield;
    }
</style>
