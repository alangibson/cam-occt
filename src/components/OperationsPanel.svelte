<script lang="ts">
    import type { Operation } from '$lib/stores/operations/interfaces';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
    import type { Tool } from '$lib/stores/tools/store';
    import { flip } from 'svelte/animate';
    import { CutDirection, LeadType } from '$lib/types/direction';
    import { KerfCompensation } from '$lib/types/kerf-compensation';
    import { OptimizeStarts } from '$lib/types/optimize-starts';
    import { getReactiveUnitSymbol } from '$lib/utils/units';
    import { settingsStore } from '$lib/stores/settings/store';

    // Props
    export let operations: Operation[] = [];
    export let chains: Chain[] = [];
    export let parts: DetectedPart[] = [];
    export let dragOverIndex: number | null = null;
    export let toolSearchTerms: { [operationId: string]: string } = {};
    export let showToolDropdowns: { [operationId: string]: boolean } = {};
    export let showApplyToMenus: { [operationId: string]: boolean } = {};
    export let hoveredPartId: string | null = null;
    export let hoveredChainId: string | null = null;
    export let collapsedOperations: { [operationId: string]: boolean } = {};
    export let availableTools: Tool[] = [];

    // Event handlers passed as props
    export let updateOperationField: <K extends keyof Operation>(
        id: string,
        field: K,
        value: Operation[K]
    ) => void;
    export let deleteOperation: (id: string) => void;
    export let duplicateOperation: (id: string) => void;
    export let toggleTargetSelection: (
        operationId: string,
        targetId: string
    ) => void;
    export let selectAllTargets: (
        operationId: string,
        targetType: 'parts' | 'chains'
    ) => void;
    export let clearAllTargets: (operationId: string) => void;
    export let handleDragStart: (
        event: DragEvent,
        operation: Operation
    ) => void;
    export let handleDragOver: (event: DragEvent, index: number) => void;
    export let handleDragLeave: () => void;
    export let handleDrop: (event: DragEvent, dropIndex: number) => void;
    export let getToolName: (toolId: string | null) => string;
    export let getFilteredTools: (operationId: string) => Tool[];
    export let selectTool: (operationId: string, toolId: string | null) => void;
    export let toggleToolDropdown: (operationId: string) => void;
    export let handleToolKeydown: (
        event: KeyboardEvent,
        operationId: string
    ) => void;
    export let handleApplyToKeydown: (
        event: KeyboardEvent,
        operationId: string
    ) => void;
    export let toggleApplyToMenu: (operationId: string) => void;
    export let getSelectedTargetsText: (operation: Operation) => string;
    export let handlePartHover: (partId: string | null) => void;
    export let handleChainHover: (chainId: string | null) => void;
    export let isTargetAssignedToOther: (
        targetId: string,
        targetType: 'parts' | 'chains',
        operationId: string
    ) => boolean;
    export let toggleOperationCollapse: (operationId: string) => void;
</script>

<div class="operations-container">
    <div class="operations-list">
        {#each operations as operation, index (operation.id)}
            <div
                class="operation-item {dragOverIndex === index
                    ? 'drag-over'
                    : ''}"
                role="listitem"
                data-operation-id={operation.id}
                draggable="true"
                ondragstart={(e) => handleDragStart(e, operation)}
                ondragover={(e) => handleDragOver(e, index)}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, index)}
                animate:flip={{ duration: 200 }}
            >
                <div class="operation-header">
                    <span class="drag-handle">☰</span>
                    <input
                        type="checkbox"
                        checked={operation.enabled}
                        onchange={(e) =>
                            updateOperationField(
                                operation.id,
                                'enabled',
                                e.currentTarget.checked
                            )}
                        class="enabled-checkbox"
                        title="Enable/disable this operation"
                    />
                    <input
                        type="text"
                        value={operation.name}
                        onchange={(e) =>
                            updateOperationField(
                                operation.id,
                                'name',
                                e.currentTarget.value
                            )}
                        class="operation-name-input"
                    />
                    <button
                        type="button"
                        class="collapse-button"
                        onclick={() => toggleOperationCollapse(operation.id)}
                        title="Expand/collapse operation details"
                    >
                        <span class="collapse-arrow"
                            >{collapsedOperations[operation.id]
                                ? '▶'
                                : '▼'}</span
                        >
                    </button>
                </div>

                {#if !collapsedOperations[operation.id]}
                    <div class="operation-details">
                        <div class="field-group">
                            <label for="tool-{operation.id}">Tool:</label>
                            <div class="tool-selector">
                                <button
                                    type="button"
                                    class="tool-select-button"
                                    onclick={() =>
                                        toggleToolDropdown(operation.id)}
                                    onkeydown={(e) =>
                                        handleToolKeydown(e, operation.id)}
                                >
                                    {getToolName(operation.toolId)}
                                    <span class="dropdown-arrow"
                                        >{showToolDropdowns[operation.id]
                                            ? '▲'
                                            : '▼'}</span
                                    >
                                </button>

                                {#if showToolDropdowns[operation.id]}
                                    <div class="tool-dropdown">
                                        <input
                                            type="text"
                                            placeholder="Search tools..."
                                            bind:value={
                                                toolSearchTerms[operation.id]
                                            }
                                            class="tool-search-input"
                                        />
                                        <div class="tool-options">
                                            <button
                                                type="button"
                                                class="tool-option {operation.toolId ===
                                                null
                                                    ? 'selected'
                                                    : ''}"
                                                onclick={() =>
                                                    selectTool(
                                                        operation.id,
                                                        null
                                                    )}
                                            >
                                                No Tool
                                            </button>
                                            {#each getFilteredTools(operation.id) as tool (tool.id)}
                                                <button
                                                    type="button"
                                                    class="tool-option {operation.toolId ===
                                                    tool.id
                                                        ? 'selected'
                                                        : ''}"
                                                    onclick={() =>
                                                        selectTool(
                                                            operation.id,
                                                            tool.id
                                                        )}
                                                >
                                                    #{tool.toolNumber} - {tool.toolName}
                                                </button>
                                            {:else}
                                                <div class="no-tools">
                                                    No tools available (Store
                                                    has {availableTools.length}
                                                    tools)
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Apply to section on its own row -->
                    <div class="operation-row">
                        <div class="field-group apply-to-row">
                            <label for="apply-to-{operation.id}"
                                >Apply to:</label
                            >
                            <div class="apply-to-selector">
                                <button
                                    type="button"
                                    class="apply-to-button"
                                    onclick={() =>
                                        toggleApplyToMenu(operation.id)}
                                    onkeydown={(e) =>
                                        handleApplyToKeydown(e, operation.id)}
                                >
                                    {getSelectedTargetsText(operation)}
                                    <span class="dropdown-arrow"
                                        >{showApplyToMenus[operation.id]
                                            ? '▲'
                                            : '▼'}</span
                                    >
                                </button>

                                {#if showApplyToMenus[operation.id]}
                                    <div class="apply-to-dropdown">
                                        <div class="target-type-tabs">
                                            <button
                                                type="button"
                                                class="target-type-tab {operation.targetType ===
                                                'parts'
                                                    ? 'active'
                                                    : ''}"
                                                onclick={() =>
                                                    updateOperationField(
                                                        operation.id,
                                                        'targetType',
                                                        'parts'
                                                    )}
                                            >
                                                Parts ({parts.length})
                                            </button>
                                            <button
                                                type="button"
                                                class="target-type-tab {operation.targetType ===
                                                'chains'
                                                    ? 'active'
                                                    : ''}"
                                                onclick={() =>
                                                    updateOperationField(
                                                        operation.id,
                                                        'targetType',
                                                        'chains'
                                                    )}
                                            >
                                                Chains ({chains.length})
                                            </button>
                                        </div>

                                        <div class="target-options">
                                            <div class="select-all-container">
                                                <button
                                                    type="button"
                                                    class="select-all-button"
                                                    onclick={() =>
                                                        selectAllTargets(
                                                            operation.id,
                                                            operation.targetType
                                                        )}
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    type="button"
                                                    class="clear-all-button"
                                                    onclick={() =>
                                                        clearAllTargets(
                                                            operation.id
                                                        )}
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                            {#if operation.targetType === 'parts'}
                                                {#each parts as part (part.id)}
                                                    {@const isAssigned =
                                                        isTargetAssignedToOther(
                                                            part.id,
                                                            'parts',
                                                            operation.id
                                                        )}
                                                    <label
                                                        class="target-option {hoveredPartId ===
                                                        part.id
                                                            ? 'hovered'
                                                            : ''} {isAssigned
                                                            ? 'disabled'
                                                            : ''}"
                                                        onmouseenter={() =>
                                                            handlePartHover(
                                                                part.id
                                                            )}
                                                        onmouseleave={() =>
                                                            handlePartHover(
                                                                null
                                                            )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={operation.targetIds.includes(
                                                                part.id
                                                            )}
                                                            disabled={isAssigned}
                                                            onchange={() =>
                                                                toggleTargetSelection(
                                                                    operation.id,
                                                                    part.id
                                                                )}
                                                        />
                                                        <span
                                                            class="target-label"
                                                            >Part {part.id.split(
                                                                '-'
                                                            )[1]}</span
                                                        >
                                                        <span
                                                            class="target-info"
                                                            >({part.holes
                                                                .length} holes)</span
                                                        >
                                                        {#if isAssigned}
                                                            <span
                                                                class="assigned-indicator"
                                                                >Assigned</span
                                                            >
                                                        {/if}
                                                    </label>
                                                {/each}
                                                {#if parts.length === 0}
                                                    <div class="no-targets">
                                                        No parts available
                                                    </div>
                                                {/if}
                                            {:else}
                                                {#each chains as chain (chain.id)}
                                                    {@const isAssigned =
                                                        isTargetAssignedToOther(
                                                            chain.id,
                                                            'chains',
                                                            operation.id
                                                        )}
                                                    <label
                                                        class="target-option {hoveredChainId ===
                                                        chain.id
                                                            ? 'hovered'
                                                            : ''} {isAssigned
                                                            ? 'disabled'
                                                            : ''}"
                                                        onmouseenter={() =>
                                                            handleChainHover(
                                                                chain.id
                                                            )}
                                                        onmouseleave={() =>
                                                            handleChainHover(
                                                                null
                                                            )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={operation.targetIds.includes(
                                                                chain.id
                                                            )}
                                                            disabled={isAssigned}
                                                            onchange={() =>
                                                                toggleTargetSelection(
                                                                    operation.id,
                                                                    chain.id
                                                                )}
                                                        />
                                                        <span
                                                            class="target-label"
                                                            >Chain {chain.id.split(
                                                                '-'
                                                            )[1]}</span
                                                        >
                                                        <span
                                                            class="target-info"
                                                            >({chain.shapes
                                                                .length} shapes)</span
                                                        >
                                                        {#if isAssigned}
                                                            <span
                                                                class="assigned-indicator"
                                                                >Assigned</span
                                                            >
                                                        {/if}
                                                    </label>
                                                {/each}
                                                {#if chains.length === 0}
                                                    <div class="no-targets">
                                                        No chains available
                                                    </div>
                                                {/if}
                                            {/if}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Divider -->
                    <div class="operation-divider"></div>

                    <!-- Cut Direction -->
                    <div class="operation-row">
                        <div class="field-group">
                            <label for="cut-direction-{operation.id}"
                                >Cut Direction:</label
                            >
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
                                <option value="counterclockwise"
                                    >Counterclockwise</option
                                >
                                <option value="clockwise">Clockwise</option>
                            </select>
                        </div>
                    </div>

                    <!-- Hole Cutting Settings (only for part operations) -->
                    {#if operation.targetType === 'parts'}
                        <div class="operation-row">
                            <div class="field-group">
                                <label class="hole-underspeed-label">
                                    <input
                                        type="checkbox"
                                        checked={operation.holeUnderspeedEnabled ||
                                            false}
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
                                    <label for="hole-underspeed-{operation.id}"
                                        >Velocity (%):</label
                                    >
                                    <input
                                        id="hole-underspeed-{operation.id}"
                                        type="number"
                                        min="10"
                                        max="100"
                                        step="5"
                                        value={operation.holeUnderspeedPercent ||
                                            60}
                                        onchange={(e) =>
                                            updateOperationField(
                                                operation.id,
                                                'holeUnderspeedPercent',
                                                Math.max(
                                                    10,
                                                    Math.min(
                                                        100,
                                                        parseInt(
                                                            e.currentTarget
                                                                .value
                                                        ) || 60
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
                            <label for="lead-in-type-{operation.id}"
                                >Lead-in:</label
                            >
                            <select
                                id="lead-in-type-{operation.id}"
                                value={operation.leadInConfig?.type ||
                                    LeadType.NONE}
                                onchange={(e) =>
                                    updateOperationField(
                                        operation.id,
                                        'leadInConfig',
                                        {
                                            ...operation.leadInConfig,
                                            type: e.currentTarget
                                                .value as LeadType,
                                        }
                                    )}
                                class="lead-select"
                            >
                                <option value="none">None</option>
                                <option value="arc">Arc</option>
                            </select>
                        </div>

                        <div class="field-group">
                            <label for="lead-out-type-{operation.id}"
                                >Lead-out:</label
                            >
                            <select
                                id="lead-out-type-{operation.id}"
                                value={operation.leadOutConfig?.type ||
                                    LeadType.NONE}
                                onchange={(e) =>
                                    updateOperationField(
                                        operation.id,
                                        'leadOutConfig',
                                        {
                                            ...operation.leadOutConfig,
                                            type: e.currentTarget
                                                .value as LeadType,
                                        }
                                    )}
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
                                        $settingsStore.settings
                                            .measurementSystem
                                    )}):</label
                                >
                                <input
                                    id="lead-in-length-{operation.id}"
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={operation.leadInConfig?.length || 0}
                                    onchange={(e) =>
                                        updateOperationField(
                                            operation.id,
                                            'leadInConfig',
                                            {
                                                ...operation.leadInConfig,
                                                length:
                                                    parseFloat(
                                                        e.currentTarget.value
                                                    ) || 0,
                                            }
                                        )}
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
                                        $settingsStore.settings
                                            .measurementSystem
                                    )}):</label
                                >
                                <input
                                    id="lead-out-length-{operation.id}"
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={operation.leadOutConfig?.length || 0}
                                    onchange={(e) =>
                                        updateOperationField(
                                            operation.id,
                                            'leadOutConfig',
                                            {
                                                ...operation.leadOutConfig,
                                                length:
                                                    parseFloat(
                                                        e.currentTarget.value
                                                    ) || 0,
                                            }
                                        )}
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
                            <label for="kerf-compensation-{operation.id}"
                                >Kerf Compensation:</label
                            >
                            <select
                                id="kerf-compensation-{operation.id}"
                                value={operation.kerfCompensation ||
                                    KerfCompensation.NONE}
                                onchange={(e) =>
                                    updateOperationField(
                                        operation.id,
                                        'kerfCompensation',
                                        e.currentTarget.value as
                                            | KerfCompensation
                                            | undefined
                                    )}
                                class="lead-select"
                            >
                                <option value={KerfCompensation.NONE}
                                    >None</option
                                >
                                <option value={KerfCompensation.INNER}
                                    >Inner</option
                                >
                                <option value={KerfCompensation.OUTER}
                                    >Outer</option
                                >
                                <option value={KerfCompensation.PART}
                                    >Part</option
                                >
                            </select>
                        </div>
                    </div>

                    <!-- Divider -->
                    <div class="operation-divider"></div>

                    <!-- Optimize Starts Settings -->
                    <div class="optimize-starts-row">
                        <div class="field-group">
                            <label for="optimize-starts-{operation.id}"
                                >Optimize Starts:</label
                            >
                            <select
                                id="optimize-starts-{operation.id}"
                                value={operation.optimizeStarts ||
                                    OptimizeStarts.MIDPOINT}
                                onchange={(e) =>
                                    updateOperationField(
                                        operation.id,
                                        'optimizeStarts',
                                        e.currentTarget.value as OptimizeStarts
                                    )}
                                class="lead-select"
                            >
                                <option value={OptimizeStarts.NONE}>None</option
                                >
                                <option value={OptimizeStarts.MIDPOINT}
                                    >Midpoint</option
                                >
                            </select>
                        </div>
                    </div>

                    <div class="operation-actions">
                        <button
                            onclick={() => duplicateOperation(operation.id)}
                            class="btn btn-secondary btn-xs"
                            title="Duplicate operation"
                        >
                            ⎘
                        </button>
                        <button
                            onclick={() => deleteOperation(operation.id)}
                            class="btn btn-danger btn-xs"
                            title="Delete operation"
                        >
                            ✕
                        </button>
                    </div>
                {/if}
            </div>
        {/each}

        {#if operations.length === 0}
            <div class="no-operations">
                <p>No operations created yet.</p>
                <p>Click Add button to create cuts</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .operations-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-height: 700px;
        overflow-y: auto;
    }

    .operations-list:empty,
    .operations-list:has(.no-operations) {
        max-height: 200px;
    }

    .operation-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.75rem;
        transition: all 0.2s;
    }

    .operation-item:hover {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .operation-item.drag-over {
        background: #e6f2ff;
        border-color: rgb(0, 83, 135);
    }

    .operation-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .drag-handle {
        cursor: move;
        color: #6b7280;
        font-size: 1rem;
    }

    .operation-name-input {
        flex: 1;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
    }

    .collapse-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.25rem;
        transition: all 0.2s;
    }

    .collapse-button:hover {
        background: #f3f4f6;
        color: #374151;
    }

    .collapse-arrow {
        font-size: 0.875rem;
        transition: transform 0.2s;
    }

    .enabled-checkbox {
        cursor: pointer;
        margin: 0 0.5rem;
        transform: scale(1.2); /* Make checkbox slightly larger */
    }

    .operation-details {
        margin-bottom: 0.75rem;
    }

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

    .tool-selector,
    .apply-to-selector {
        position: relative;
    }

    .tool-select-button,
    .apply-to-button {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        background: white;
        text-align: left;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .tool-select-button:hover,
    .apply-to-button:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .dropdown-arrow {
        font-size: 0.75rem;
        color: #6b7280;
        margin-left: 0.5rem;
    }

    .cut-direction-select {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
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

    .tool-dropdown,
    .apply-to-dropdown {
        position: fixed;
        z-index: 1000;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        box-shadow:
            0 10px 25px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
        min-width: 300px;
        max-width: 400px;
        max-height: 400px;
        overflow-y: auto;
    }

    .tool-search-input {
        width: 100%;
        padding: 0.5rem;
        border: none;
        border-bottom: 1px solid #e5e7eb;
        font-size: 0.875rem;
        outline: none;
    }

    .tool-search-input:focus {
        border-bottom-color: #3b82f6;
    }

    .tool-options,
    .target-options {
        padding: 0.25rem 0;
    }

    .select-all-container {
        padding: 0.5rem;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        gap: 0.5rem;
    }

    .select-all-button,
    .clear-all-button {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .select-all-button {
        color: rgb(0, 83, 135);
    }

    .select-all-button:hover {
        background: #e6f2ff;
        border-color: rgb(0, 83, 135);
    }

    .clear-all-button {
        color: #6b7280;
    }

    .clear-all-button:hover {
        background: #f3f4f6;
        border-color: #6b7280;
    }

    .tool-option {
        width: 100%;
        padding: 0.5rem;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        font-size: 0.875rem;
        display: block;
    }

    .tool-option:hover {
        background: #f3f4f6;
    }

    .tool-option.selected {
        background: #e6f2ff;
        color: rgb(0, 83, 135);
    }

    .target-type-tabs {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
    }

    .target-type-tab {
        flex: 1;
        padding: 0.5rem;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .target-type-tab:hover {
        background: #f3f4f6;
    }

    .target-type-tab.active {
        background: #e6f2ff;
        color: rgb(0, 83, 135);
        border-bottom: 2px solid rgb(0, 83, 135);
    }

    .target-option {
        display: flex;
        align-items: center;
        padding: 0.5rem;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .target-option:hover {
        background: #f3f4f6;
    }

    .target-option.hovered {
        background: #e6f2ff;
        border-left: 3px solid rgb(0, 83, 135);
    }

    .target-option.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .target-option.disabled input {
        cursor: not-allowed;
    }

    .assigned-indicator {
        margin-left: auto;
        font-size: 0.75rem;
        color: #6b7280;
        font-style: italic;
    }

    .target-option :global(input[type=\"checkbox\"]) {
        margin-right: 0.5rem;
    }

    .target-label {
        font-weight: 500;
    }

    .target-info {
        margin-left: 0.5rem;
        color: #6b7280;
        font-size: 0.8rem;
    }

    .no-targets {
        padding: 1rem;
        text-align: center;
        color: #6b7280;
        font-size: 0.875rem;
        font-style: italic;
    }

    .operation-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
    }

    .no-operations {
        text-align: center;
        color: #6b7280;
        font-size: 0.875rem;
        padding: 2rem;
    }

    .no-operations p {
        margin: 0.5rem 0;
    }

    .btn {
        padding: 0.375rem 0.75rem;
        border: none;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .btn-secondary {
        background: #6b7280;
        color: white;
    }

    .btn-secondary:hover {
        background: #4b5563;
    }

    .btn-danger {
        background: rgb(133, 18, 0);
        color: white;
    }

    .btn-danger:hover {
        background: rgb(133, 18, 0);
    }

    .btn-xs {
        padding: 0.125rem 0.375rem;
        font-size: 0.75rem;
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
        border-radius: 0.25rem;
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
        border-radius: 0.25rem;
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

    /* Apply to row styling */
    .apply-to-row {
        width: 100%;
    }

    .apply-to-row .apply-to-selector {
        width: 100%;
    }

    .operation-row {
        margin-top: 0.75rem;
    }

    .operation-divider {
        height: 1px;
        background-color: #e5e7eb;
        margin: 0.75rem 0;
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

    /* Optimize starts row styling */
    .optimize-starts-row {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .optimize-starts-row .field-group {
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
        border-radius: 0.25rem;
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
