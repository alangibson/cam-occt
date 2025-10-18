<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store';
    import { Unit, getUnitSymbol } from '$lib/config/units/units';

    // Get current display unit from store
    $: displayUnit = $drawingStore.displayUnit;

    // Get unit symbols (no need for reactive since these are constants)
    const mmSymbol = getUnitSymbol(Unit.MM);
    const inchSymbol = getUnitSymbol(Unit.INCH);

    function handleUnitChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        const newUnit = target.value as Unit;

        // Update the drawing store with the new display unit
        drawingStore.setDisplayUnit(newUnit);
    }
</script>

<div class="units-box">
    <div class="unit-selector">
        <label for="unit-dropdown">Display Units:</label>
        <select
            id="unit-dropdown"
            value={displayUnit}
            on:change={handleUnitChange}
        >
            <option value="mm">Millimeters ({mmSymbol})</option>
            <option value="inch">Inches ({inchSymbol})</option>
        </select>
    </div>

    <div class="unit-info">
        <p class="note">
            Units are for display only. Changing units will scale the visual
            size to match physical dimensions but will not modify the underlying
            geometry.
        </p>
    </div>
</div>

<style>
    .units-box {
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 1rem;
    }

    /* h3 header removed - title now handled by AccordionPanel */

    .unit-selector {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .unit-selector label {
        font-size: 0.9rem;
        color: #555;
        font-weight: 500;
    }

    .unit-selector select {
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.9rem;
        background-color: white;
        cursor: pointer;
    }

    .unit-selector select:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.1);
    }

    .unit-info {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }

    .note {
        font-size: 0.8rem;
        color: #666;
        margin: 0;
        line-height: 1.4;
    }
</style>
