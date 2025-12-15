<script lang="ts">
    import type { OperationData } from '$lib/cam/operation/interface';
    import type { Operation } from '$lib/cam/operation/classes.svelte';
    import { DEFAULT_SPOT_DURATION } from '$lib/config/defaults/operation-defaults';

    // Props
    export let operation: Operation;
    export let updateOperationField: <K extends keyof OperationData>(
        id: string,
        field: K,
        value: OperationData[K]
    ) => void;
</script>

<!-- Duration -->
<div class="operation-row">
    <div class="field-group">
        <label for="duration-{operation.id}">Duration (ms):</label>
        <input
            id="duration-{operation.id}"
            type="number"
            min="1"
            step="100"
            value={operation.spotDuration || DEFAULT_SPOT_DURATION}
            onchange={(e) => {
                const value = parseFloat(e.currentTarget.value);
                updateOperationField(
                    operation.id,
                    'spotDuration',
                    value > 0 ? value : DEFAULT_SPOT_DURATION
                );
            }}
            class="duration-input"
        />
    </div>
</div>

<style>
    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .field-group label {
        font-size: 0.8rem;
        font-weight: 500;
        color: #374151;
    }

    .duration-input {
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        font-size: 0.875rem;
        background: white;
        width: 120px;
    }

    .duration-input:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .duration-input:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }

    .operation-row {
        margin-top: 0.75rem;
    }
</style>
