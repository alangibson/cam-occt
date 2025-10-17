<script lang="ts">
    import { cutStore } from '$lib/stores/cuts/store';
    import { operationsStore } from '$lib/stores/operations/store';
    import { CutDirection } from '$lib/cam/cut/enums';

    // Reactive cut data
    $: cuts = $cutStore.cuts;
    $: selectedCutId = $cutStore.selectedCutId;
    $: selectedCut = selectedCutId
        ? cuts.find((cut) => cut.id === selectedCutId)
        : null;
    $: operations = $operationsStore;
    $: selectedOperation =
        selectedCut && operations && operations.length > 0
            ? operations.find((op) => op.id === selectedCut.operationId)
            : null;

    function getCutDirectionLabel(direction: CutDirection): string {
        switch (direction) {
            case CutDirection.CLOCKWISE:
                return 'Clockwise (CW)';
            case CutDirection.COUNTERCLOCKWISE:
                return 'Counter-clockwise (CCW)';
            default:
                return 'Unknown';
        }
    }

    function getLeadConfigLabel(
        config: { type: string; length?: number } | undefined
    ): string {
        if (!config) return 'None';
        return `${config.type.charAt(0).toUpperCase() + config.type.slice(1)}${config.length ? ` (${config.length.toFixed(2)})` : ''}`;
    }

    async function copyCutToClipboard() {
        if (!selectedCut) return;

        try {
            const json = JSON.stringify(selectedCut, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="cut-properties">
    {#if selectedCut}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">Name:</span>
                <span class="property-value">{selectedCut.name}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Enabled:</span>
                <span
                    class="property-value {selectedCut.enabled
                        ? 'enabled'
                        : 'disabled'}"
                >
                    {selectedCut.enabled ? 'Yes' : 'No'}
                </span>
            </div>

            <div class="property-row">
                <span class="property-label">Order:</span>
                <span class="property-value">{selectedCut.order}</span>
            </div>

            {#if selectedOperation}
                <div class="property-row">
                    <span class="property-label">Operation:</span>
                    <span class="property-value">{selectedOperation.name}</span>
                </div>
            {/if}

            <div class="property-row">
                <span class="property-label">Chain ID:</span>
                <span class="property-value">{selectedCut.chainId}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Cut Direction:</span>
                <span class="property-value"
                    >{getCutDirectionLabel(selectedCut.cutDirection)}</span
                >
            </div>

            {#if selectedCut.isHole !== undefined}
                <div class="property-row">
                    <span class="property-label">Is Hole:</span>
                    <span class="property-value"
                        >{selectedCut.isHole ? 'Yes' : 'No'}</span
                    >
                </div>
            {/if}

            {#if selectedCut.holeUnderspeedPercent !== undefined}
                <div class="property-row">
                    <span class="property-label">Hole Speed:</span>
                    <span class="property-value"
                        >{selectedCut.holeUnderspeedPercent}%</span
                    >
                </div>
            {/if}

            {#if selectedCut.feedRate !== undefined}
                <div class="property-row">
                    <span class="property-label">Feed Rate:</span>
                    <span class="property-value">{selectedCut.feedRate}</span>
                </div>
            {/if}

            {#if selectedCut.kerfWidth !== undefined}
                <div class="property-row">
                    <span class="property-label">Kerf Width:</span>
                    <span class="property-value"
                        >{selectedCut.kerfWidth.toFixed(3)}</span
                    >
                </div>
            {/if}

            {#if selectedCut.kerfCompensation !== undefined}
                <div class="property-row">
                    <span class="property-label">Kerf Comp:</span>
                    <span class="property-value"
                        >{selectedCut.kerfCompensation}</span
                    >
                </div>
            {/if}

            {#if selectedCut.leadInConfig}
                <div class="property-row">
                    <span class="property-label">Lead In:</span>
                    <span class="property-value"
                        >{getLeadConfigLabel(selectedCut.leadInConfig)}</span
                    >
                </div>
            {/if}

            {#if selectedCut.leadOutConfig}
                <div class="property-row">
                    <span class="property-label">Lead Out:</span>
                    <span class="property-value"
                        >{getLeadConfigLabel(selectedCut.leadOutConfig)}</span
                    >
                </div>
            {/if}

            {#if selectedCut.pierceHeight !== undefined}
                <div class="property-row">
                    <span class="property-label">Pierce Height:</span>
                    <span class="property-value"
                        >{selectedCut.pierceHeight.toFixed(2)}</span
                    >
                </div>
            {/if}

            {#if selectedCut.pierceDelay !== undefined}
                <div class="property-row">
                    <span class="property-label">Pierce Delay:</span>
                    <span class="property-value"
                        >{selectedCut.pierceDelay.toFixed(2)}s</span
                    >
                </div>
            {/if}
        </div>

        {#if selectedCut.leadValidation && selectedCut.leadValidation.warnings.length > 0}
            <div class="lead-warnings">
                <h4 class="warnings-title">Lead Warnings:</h4>
                {#each selectedCut.leadValidation.warnings as warning, i (i)}
                    <div class="warning-item">
                        <span class="warning-text">{warning}</span>
                    </div>
                {/each}
            </div>
        {/if}

        <div class="button-row">
            <button
                class="copy-button"
                onclick={copyCutToClipboard}
                title="Copy cut JSON to clipboard"
            >
                Copy
            </button>
        </div>
    {/if}
</div>

<style>
    .cut-properties {
        min-height: 200px;
    }

    .property-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .property-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.25rem 0;
        min-width: 0;
    }

    .property-label {
        font-weight: 500;
        color: #333;
        min-width: 90px;
        flex-shrink: 0;
    }

    .property-value {
        font-family: 'Courier New', monospace;
        color: #666;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex-shrink: 1;
    }

    .property-value.enabled {
        color: rgb(0, 133, 84);
        font-weight: 600;
    }

    .property-value.disabled {
        color: rgb(133, 18, 0);
        font-weight: 600;
    }

    .lead-warnings {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.375rem;
        padding: 0.75rem;
        margin-top: 1rem;
    }

    .warnings-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.5rem 0;
    }

    .warning-item {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .warning-item:last-child {
        margin-bottom: 0;
    }

    .warning-text {
        font-size: 0.75rem;
        color: rgb(133, 18, 0);
        line-height: 1.4;
    }

    .button-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .copy-button {
        padding: 0.25rem 0.75rem;
        background-color: #fff;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .copy-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
    }

    .copy-button:active {
        background-color: #f3f4f6;
    }
</style>
