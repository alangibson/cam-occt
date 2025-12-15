<script lang="ts">
    import type { OperationData } from '$lib/cam/operation/interface';
    import type { Operation } from '$lib/cam/operation/classes.svelte';
    import type { ChainData } from '$lib/cam/chain/interfaces';
    import { Chain } from '$lib/cam/chain/classes.svelte';
    import { CutDirection } from '$lib/cam/cut/enums';
    import { LeadType } from '$lib/cam/lead/enums';
    import { KerfCompensation } from '$lib/cam/operation/enums';
    import { getReactiveUnitSymbol } from '$lib/config/units/units';
    import { settingsStore } from '$lib/stores/settings/store.svelte';

    // Props
    export let operation: Operation;
    export let chains: ChainData[] = [];
    export let updateOperationField: <K extends keyof OperationData>(
        id: string,
        field: K,
        value: OperationData[K]
    ) => void;

    // Check if all selected chains are cyclic
    function areAllSelectedChainsCyclic(): boolean {
        if (
            operation.targetType !== 'chains' ||
            operation.targetIds.length === 0
        ) {
            return false;
        }

        const selectedChains = chains.filter((chain) =>
            operation.targetIds.includes(chain.id)
        );

        if (selectedChains.length === 0) {
            return false;
        }

        return selectedChains.every((chainData) => {
            const chain = new Chain(chainData);
            return chain.isCyclic();
        });
    }

    // Reactive check for whether to show hole underspeed checkbox
    $: showHoleUnderspeed =
        operation.targetType === 'parts' || areAllSelectedChainsCyclic();
</script>

<!-- Cut Direction -->
<div class="operation-row">
    <div class="field-group">
        <label for="cut-direction-{operation.id}">Cut Direction:</label>
        <select
            id="cut-direction-{operation.id}"
            value={operation.cutDirection}
            onchange={(e) =>
                updateOperationField(
                    operation.id,
                    'cutDirection',
                    e.currentTarget.value as CutDirection
                )}
            class="cut-direction-select"
        >
            <option value="counterclockwise">Counterclockwise</option>
            <option value="clockwise">Clockwise</option>
        </select>
    </div>
</div>

<!-- Hole Cutting Settings (for part operations or cyclic chain operations) -->
{#if showHoleUnderspeed}
    <div class="operation-row">
        <div class="field-group">
            <label class="hole-underspeed-label">
                <input
                    type="checkbox"
                    checked={operation.holeUnderspeedEnabled || false}
                    onchange={(e) =>
                        updateOperationField(
                            operation.id,
                            'holeUnderspeedEnabled',
                            e.currentTarget.checked
                        )}
                    class="hole-checkbox"
                />
                Enable hole underspeed
            </label>
        </div>
        {#if operation.holeUnderspeedEnabled}
            <div class="field-group">
                <label for="hole-underspeed-{operation.id}">Velocity (%):</label
                >
                <input
                    id="hole-underspeed-{operation.id}"
                    type="number"
                    min="10"
                    max="100"
                    step="5"
                    value={operation.holeUnderspeedPercent || 60}
                    onchange={(e) =>
                        updateOperationField(
                            operation.id,
                            'holeUnderspeedPercent',
                            Math.max(
                                10,
                                Math.min(
                                    100,
                                    parseInt(e.currentTarget.value) || 60
                                )
                            )
                        )}
                    class="hole-input"
                />
            </div>
        {/if}
    </div>
{/if}

<!-- Lead-in and Lead-out Settings -->
<div class="lead-settings">
    <div class="field-group">
        <label for="lead-in-type-{operation.id}">Lead-in:</label>
        <select
            id="lead-in-type-{operation.id}"
            value={operation.leadInConfig?.type || LeadType.NONE}
            onchange={(e) =>
                updateOperationField(operation.id, 'leadInConfig', {
                    ...operation.leadInConfig,
                    type: e.currentTarget.value as LeadType,
                })}
            class="lead-select"
        >
            <option value="none">None</option>
            <option value="arc">Arc</option>
        </select>
    </div>

    <div class="field-group">
        <label for="lead-out-type-{operation.id}">Lead-out:</label>
        <select
            id="lead-out-type-{operation.id}"
            value={operation.leadOutConfig?.type || LeadType.NONE}
            onchange={(e) =>
                updateOperationField(operation.id, 'leadOutConfig', {
                    ...operation.leadOutConfig,
                    type: e.currentTarget.value as LeadType,
                })}
            class="lead-select"
        >
            <option value="none">None</option>
            <option value="arc">Arc</option>
        </select>
    </div>

    {#if operation.leadInConfig?.type !== 'none'}
        <div class="field-group">
            <label for="lead-in-length-{operation.id}"
                >Length ({getReactiveUnitSymbol(
                    settingsStore.settings.measurementSystem
                )}):</label
            >
            <input
                id="lead-in-length-{operation.id}"
                type="number"
                min="0"
                step="0.1"
                value={operation.leadInConfig?.length || 0}
                onchange={(e) =>
                    updateOperationField(operation.id, 'leadInConfig', {
                        ...operation.leadInConfig,
                        length: parseFloat(e.currentTarget.value) || 0,
                    })}
                class="lead-input"
            />
        </div>
    {:else}
        <div class="field-group"></div>
    {/if}

    {#if operation.leadOutConfig?.type !== 'none'}
        <div class="field-group">
            <label for="lead-out-length-{operation.id}"
                >Length ({getReactiveUnitSymbol(
                    settingsStore.settings.measurementSystem
                )}):</label
            >
            <input
                id="lead-out-length-{operation.id}"
                type="number"
                min="0"
                step="0.1"
                value={operation.leadOutConfig?.length || 0}
                onchange={(e) =>
                    updateOperationField(operation.id, 'leadOutConfig', {
                        ...operation.leadOutConfig,
                        length: parseFloat(e.currentTarget.value) || 0,
                    })}
                class="lead-input"
            />
        </div>
    {:else}
        <div class="field-group"></div>
    {/if}
</div>

<!-- Kerf Compensation Settings -->
<div class="kerf-compensation-row">
    <div class="field-group">
        <label for="kerf-compensation-{operation.id}">Kerf Compensation:</label>
        <select
            id="kerf-compensation-{operation.id}"
            value={operation.kerfCompensation || KerfCompensation.NONE}
            onchange={(e) =>
                updateOperationField(
                    operation.id,
                    'kerfCompensation',
                    e.currentTarget.value as KerfCompensation | undefined
                )}
            class="lead-select"
        >
            <option value={KerfCompensation.NONE}>None</option>
            <option value={KerfCompensation.INNER}>Inner</option>
            <option value={KerfCompensation.OUTER}>Outer</option>
            <option value={KerfCompensation.PART}>Part</option>
        </select>
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

    .cut-direction-select {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        font-size: 0.875rem;
        background: white;
        cursor: pointer;
    }

    .cut-direction-select:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .cut-direction-select:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }

    /* Lead settings */
    .lead-settings {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem 1rem;
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .lead-select {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        font-size: 0.875rem;
        background: white;
        cursor: pointer;
    }

    .lead-select:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .lead-select:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }

    .lead-input {
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        font-size: 0.875rem;
        background: white;
    }

    .lead-input:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .lead-input:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }

    .operation-row {
        margin-top: 0.75rem;
    }

    /* Kerf compensation row styling */
    .kerf-compensation-row {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .kerf-compensation-row .field-group {
        max-width: 200px;
    }

    /* Hole underspeed styling */
    .hole-underspeed-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
    }

    .hole-checkbox {
        margin: 0;
        cursor: pointer;
    }

    .hole-input {
        width: 80px;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        font-size: 0.875rem;
        background: white;
    }

    .hole-input:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .hole-input:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }
</style>
