<script lang="ts">
    import type { OperationData } from '$lib/cam/operation/interface';
    import { Operation } from '$lib/cam/operation/classes.svelte';
    import type { ChainData } from '$lib/cam/chain/interfaces';
    import { Chain } from '$lib/cam/chain/classes';
    import type { Part } from '$lib/cam/part/classes.svelte';
    import type { Tool } from '$lib/cam/tool/interfaces';
    import { flip } from 'svelte/animate';
    import { OperationAction } from '$lib/cam/operation/enums';
    import CutOperationDetails from './CutOperationDetails.svelte';
    import SpotOperationProperties from './SpotOperationProperties.svelte';

    // Props
    export let operations: Operation[] = [];
    export let chains: ChainData[] = [];
    export let parts: Part[] = [];
    export let dragOverIndex: number | null = null;
    export let toolSearchTerms: { [operationId: string]: string } = {};
    export let showToolDropdowns: { [operationId: string]: boolean } = {};
    export let showApplyToMenus: { [operationId: string]: boolean } = {};
    export let hoveredPartId: string | null = null;
    export let hoveredChainId: string | null = null;
    export let collapsedOperations: { [operationId: string]: boolean } = {};
    export let availableTools: Tool[] = [];

    // Event handlers passed as props
    export let updateOperationField: <K extends keyof OperationData>(
        id: string,
        field: K,
        value: OperationData[K]
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
    export let getSelectedTargetsText: (operation: OperationData) => string;
    export let handlePartHover: (partId: string | null) => void;
    export let handleChainHover: (chainId: string | null) => void;
    export let isTargetAssignedToOther: (
        targetId: string,
        targetType: 'parts' | 'chains',
        operationId: string
    ) => boolean;
    export let toggleOperationCollapse: (operationId: string) => void;

    // Helper function to check if a chain is cyclic
    function isChainCyclic(chain: ChainData): boolean {
        return new Chain(chain).isCyclic();
    }

    // Helper function to check if a target should be disabled for Spot action
    function isTargetDisabledForSpot(
        operation: Operation,
        targetType: 'parts' | 'chains',
        chain?: ChainData
    ): boolean {
        if (operation.action !== OperationAction.SPOT) {
            return false;
        }

        if (targetType === 'parts') {
            // All parts are disabled for Spot action
            return true;
        }

        if (targetType === 'chains' && chain) {
            // Only non-cyclic chains are disabled for Spot action
            return !isChainCyclic(chain);
        }

        return false;
    }
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

                        <div class="field-group">
                            <label for="action-{operation.id}">Action:</label>
                            <select
                                id="action-{operation.id}"
                                value={operation.action}
                                onchange={(e) =>
                                    updateOperationField(
                                        operation.id,
                                        'action',
                                        e.currentTarget.value as OperationAction
                                    )}
                                class="action-select"
                            >
                                <option value={OperationAction.CUT}>Cut</option>
                                <option value={OperationAction.SPOT}
                                    >Spot</option
                                >
                            </select>
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
                                                    {@const isDisabledForSpot =
                                                        isTargetDisabledForSpot(
                                                            operation,
                                                            'parts'
                                                        )}
                                                    {@const isDisabled =
                                                        isAssigned ||
                                                        isDisabledForSpot}
                                                    <label
                                                        class="target-option {hoveredPartId ===
                                                        part.id
                                                            ? 'hovered'
                                                            : ''} {isDisabled
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
                                                            disabled={isDisabled}
                                                            onchange={() =>
                                                                toggleTargetSelection(
                                                                    operation.id,
                                                                    part.id
                                                                )}
                                                        />
                                                        <span
                                                            class="target-label"
                                                            >Part {(() => {
                                                                const idParts =
                                                                    part.id.split(
                                                                        '-'
                                                                    );
                                                                const layerName =
                                                                    idParts
                                                                        .slice(
                                                                            0,
                                                                            -2
                                                                        )
                                                                        .join(
                                                                            '-'
                                                                        );
                                                                const partNumber =
                                                                    idParts.slice(
                                                                        -1
                                                                    )[0];
                                                                return `${layerName}-${partNumber}`;
                                                            })()}</span
                                                        >
                                                        <span
                                                            class="target-info"
                                                            >({part.voids
                                                                .length} voids)</span
                                                        >
                                                        {#if isAssigned}
                                                            <span
                                                                class="assigned-indicator"
                                                                >Assigned</span
                                                            >
                                                        {:else if isDisabledForSpot}
                                                            <span
                                                                class="assigned-indicator"
                                                                >Not available
                                                                for Spot</span
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
                                                    {@const isDisabledForSpot =
                                                        isTargetDisabledForSpot(
                                                            operation,
                                                            'chains',
                                                            chain
                                                        )}
                                                    {@const isDisabled =
                                                        isAssigned ||
                                                        isDisabledForSpot}
                                                    <label
                                                        class="target-option {hoveredChainId ===
                                                        chain.id
                                                            ? 'hovered'
                                                            : ''} {isDisabled
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
                                                            disabled={isDisabled}
                                                            onchange={() =>
                                                                toggleTargetSelection(
                                                                    operation.id,
                                                                    chain.id
                                                                )}
                                                        />
                                                        <span
                                                            class="target-label"
                                                            >Chain {chain.id
                                                                .split('-')
                                                                .slice(
                                                                    -1
                                                                )[0]}</span
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
                                                        {:else if isDisabledForSpot}
                                                            <span
                                                                class="assigned-indicator"
                                                                >Not cyclic</span
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

                    <!-- Cut Operation Details (only for cut action) -->
                    {#if operation.action === OperationAction.CUT}
                        <CutOperationDetails
                            {operation}
                            {updateOperationField}
                        />
                    {:else if operation.action === OperationAction.SPOT}
                        <SpotOperationProperties
                            {operation}
                            {updateOperationField}
                        />
                    {/if}

                    <!-- Divider -->
                    <!-- <div class="operation-divider"></div> -->

                    <!-- Optimize Starts Settings -->
                    <!-- <div class="optimize-starts-row">
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
                    </div> -->

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

    .action-select {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        background: white;
        cursor: pointer;
    }

    .action-select:hover {
        border-color: #9ca3af;
        background: #f9fafb;
    }

    .action-select:focus {
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
</style>
