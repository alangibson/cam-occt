<script lang="ts">
    import { operationsStore } from '$lib/stores/operations/store';
    import { toolStore, type Tool } from '$lib/stores/tools/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { flip } from 'svelte/animate';
    import { onMount } from 'svelte';
    import { CutDirection, LeadType } from '$lib/types/direction';
    import { KerfCompensation } from '$lib/types/kerf-compensation';
    import type { Operation } from '$lib/stores/operations/interfaces';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
    import {
        DEFAULT_LEAD_IN_CONFIG,
        DEFAULT_LEAD_OUT_CONFIG,
        DEFAULT_CUT_DIRECTION,
        DEFAULT_KERF_COMPENSATION,
        DEFAULT_HOLE_UNDERSPEED,
        DEFAULT_OPERATION_ENABLED,
    } from '$lib/constants/operation-defaults';

    let operations: Operation[] = [];
    let chains: Chain[] = [];
    let parts: DetectedPart[] = [];
    let draggedOperation: Operation | null = null;
    let dragOverIndex: number | null = null;

    // Tool search functionality
    let toolSearchTerms: { [operationId: string]: string } = {};
    let showToolDropdowns: { [operationId: string]: boolean } = {};

    // Apply to menu functionality
    let showApplyToMenus: { [operationId: string]: boolean } = {};

    // Hover highlighting for parts/chains
    let hoveredPartId: string | null = null;
    let hoveredChainId: string | null = null;

    // Collapsed state for operations
    let collapsedOperations: { [operationId: string]: boolean } = {};

    // Track assigned targets for side effects
    $: if ($operationsStore) {
        operationsStore.getAssignedTargets();
    }

    // Reactive statement to ensure proper tool store reactivity
    $: console.log('Tools reactive update:', $toolStore);
    $: availableTools = $toolStore;

    // Tools and operations are now handled by the main persistence system
    onMount(() => {
        // No need to load from localStorage anymore - handled by main persistence system

        // Add click-outside handler to close dropdowns
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Element;
            if (
                !target.closest('.tool-selector') &&
                !target.closest('.apply-to-selector') &&
                !target.closest('.tool-dropdown') &&
                !target.closest('.apply-to-dropdown')
            ) {
                showToolDropdowns = {};
                showApplyToMenus = {};
            }
        }

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    });

    // Subscribe to stores and save operations to localStorage
    operationsStore.subscribe((value) => {
        operations = value;
        // Operations are now saved by the main persistence system
    });
    chainStore.subscribe((state) => (chains = state.chains));
    partStore.subscribe((state) => (parts = state.parts));

    export function addNewOperation() {
        const newOrder =
            operations.length > 0
                ? Math.max(...operations.map((op) => op.order)) + 1
                : 1;

        // Auto-populate targetIds based on current selection
        let targetType: 'parts' | 'chains' = 'parts';
        let targetIds: string[] = [];

        // Check if a part is selected
        const selectedPartId = $partStore.selectedPartId;
        if (selectedPartId) {
            targetType = 'parts';
            targetIds = [selectedPartId];
        }
        // Check if a chain is selected
        else {
            const selectedChainId = $chainStore.selectedChainId;
            if (selectedChainId) {
                targetType = 'chains';
                targetIds = [selectedChainId];
            }
        }

        operationsStore.addOperation({
            name: `Operation ${newOrder}`,
            toolId: $toolStore.length > 0 ? $toolStore[0].id : null,
            targetType,
            targetIds,
            enabled: DEFAULT_OPERATION_ENABLED,
            order: newOrder,
            cutDirection: DEFAULT_CUT_DIRECTION,
            leadInConfig: DEFAULT_LEAD_IN_CONFIG,
            leadOutConfig: DEFAULT_LEAD_OUT_CONFIG,
            kerfCompensation:
                targetType === 'parts'
                    ? DEFAULT_KERF_COMPENSATION.forParts
                    : DEFAULT_KERF_COMPENSATION.forChains,
            holeUnderspeedEnabled: DEFAULT_HOLE_UNDERSPEED.enabled,
            holeUnderspeedPercent: DEFAULT_HOLE_UNDERSPEED.percent,
        });
    }

    function deleteOperation(id: string) {
        operationsStore.deleteOperation(id);
    }

    function duplicateOperation(id: string) {
        operationsStore.duplicateOperation(id);
    }

    function updateOperationField<K extends keyof Operation>(
        id: string,
        field: K,
        value: Operation[K]
    ) {
        operationsStore.updateOperation(id, { [field]: value });
    }

    function toggleTargetSelection(operationId: string, targetId: string) {
        const operation = operations.find((op) => op.id === operationId);
        if (!operation) return;

        const newTargetIds = operation.targetIds.includes(targetId)
            ? operation.targetIds.filter((id) => id !== targetId)
            : [...operation.targetIds, targetId];

        updateOperationField(operationId, 'targetIds', newTargetIds);
    }

    // Drag and drop functions
    function handleDragStart(event: DragEvent, operation: Operation) {
        draggedOperation = operation;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    function handleDragOver(event: DragEvent, index: number) {
        event.preventDefault();
        dragOverIndex = index;
    }

    function handleDragLeave() {
        dragOverIndex = null;
    }

    function handleDrop(event: DragEvent, dropIndex: number) {
        event.preventDefault();
        if (!draggedOperation) return;

        const draggedIndex = operations.findIndex(
            (op) => op.id === draggedOperation!.id
        );
        if (draggedIndex === -1) return;

        const newOperations = [...operations];
        newOperations.splice(draggedIndex, 1);
        newOperations.splice(dropIndex, 0, draggedOperation);

        // Update order values
        newOperations.forEach((op, index) => {
            op.order = index + 1;
        });

        operationsStore.reorderOperations(newOperations);
        draggedOperation = null;
        dragOverIndex = null;
    }

    function getToolName(toolId: string | null): string {
        if (!toolId) return 'No Tool';
        const tool = $toolStore.find((t) => t.id === toolId);
        return tool ? tool.toolName : 'Unknown Tool';
    }

    function getFilteredTools(operationId: string): Tool[] {
        const searchTerm = toolSearchTerms[operationId] || '';
        if (!searchTerm) return availableTools;
        return availableTools.filter(
            (tool) =>
                tool.toolName
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                tool.toolNumber.toString().includes(searchTerm)
        );
    }

    function selectTool(operationId: string, toolId: string | null) {
        updateOperationField(operationId, 'toolId', toolId);
        showToolDropdowns[operationId] = false;
        toolSearchTerms[operationId] = '';
    }

    function toggleToolDropdown(operationId: string) {
        showToolDropdowns[operationId] = !showToolDropdowns[operationId];
        if (!showToolDropdowns[operationId]) {
            toolSearchTerms[operationId] = '';
        }

        // Position the dropdown after it's shown
        if (showToolDropdowns[operationId]) {
            setTimeout(() => positionDropdown(operationId, 'tool'), 0);
        }
    }

    function handleToolKeydown(event: KeyboardEvent, operationId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleToolDropdown(operationId);
        } else if (event.key === 'Escape') {
            showToolDropdowns[operationId] = false;
            toolSearchTerms[operationId] = '';
        }
    }

    function handleApplyToKeydown(event: KeyboardEvent, operationId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleApplyToMenu(operationId);
        } else if (event.key === 'Escape') {
            showApplyToMenus[operationId] = false;
        }
    }

    function toggleApplyToMenu(operationId: string) {
        showApplyToMenus[operationId] = !showApplyToMenus[operationId];

        // Position the dropdown after it's shown
        if (showApplyToMenus[operationId]) {
            setTimeout(() => positionDropdown(operationId, 'apply-to'), 0);
        }
    }

    function positionDropdown(operationId: string, type: 'tool' | 'apply-to') {
        const buttonSelector =
            type === 'tool' ? 'tool-select-button' : 'apply-to-button';
        const dropdownSelector =
            type === 'tool' ? 'tool-dropdown' : 'apply-to-dropdown';

        // Find the specific button and dropdown for this operation
        const operationElement = document.querySelector(
            `[data-operation-id="${operationId}"]`
        ) as HTMLElement;
        if (!operationElement) return;

        const button = operationElement.querySelector(
            `.${buttonSelector}`
        ) as HTMLElement;
        const dropdown = operationElement.querySelector(
            `.${dropdownSelector}`
        ) as HTMLElement;

        if (button && dropdown) {
            const buttonRect = button.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Position below the button by default
            let top = buttonRect.bottom + 4;
            let left = buttonRect.left;

            // Check if dropdown would go off the bottom of the screen
            if (top + 400 > viewportHeight) {
                // Position above the button instead
                top = buttonRect.top - 404; // 400px height + 4px gap
            }

            // Check if dropdown would go off the right of the screen
            if (left + 300 > viewportWidth) {
                left = viewportWidth - 304; // 300px width + 4px margin
            }

            // Ensure dropdown doesn't go off the left of the screen
            if (left < 4) {
                left = 4;
            }

            dropdown.style.top = `${top}px`;
            dropdown.style.left = `${left}px`;
        }
    }

    function getSelectedTargetsText(operation: Operation): string {
        if (operation.targetIds.length === 0) {
            return 'None selected';
        }

        if (operation.targetType === 'parts') {
            const selectedParts = parts.filter((p) =>
                operation.targetIds.includes(p.id)
            );
            return selectedParts
                .map((p) => `Part ${p.id.split('-')[1]}`)
                .join(', ');
        } else {
            const selectedChains = chains.filter((c) =>
                operation.targetIds.includes(c.id)
            );
            return selectedChains
                .map((c) => `Chain ${c.id.split('-')[1]}`)
                .join(', ');
        }
    }

    function handlePartHover(partId: string | null) {
        hoveredPartId = partId;
        // Here you could also trigger highlighting in the drawing canvas
        if (partId) {
            partStore.highlightPart(partId);
        } else {
            partStore.clearHighlight();
        }
    }

    function handleChainHover(chainId: string | null) {
        hoveredChainId = chainId;
        // Sync with chain selection in drawing canvas
        chainStore.selectChain(chainId);
    }

    function isTargetAssignedToOther(
        targetId: string,
        targetType: 'parts' | 'chains',
        operationId: string
    ): boolean {
        const assigned = operationsStore.getAssignedTargets(operationId);
        if (targetType === 'chains') {
            return assigned.chains.has(targetId);
        } else {
            return assigned.parts.has(targetId);
        }
    }

    function toggleOperationCollapse(operationId: string) {
        collapsedOperations[operationId] = !collapsedOperations[operationId];
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

                    <!-- Lead-in and Lead-out Settings -->
                    <div class="lead-settings">
                        <div class="lead-group">
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
                            {#if operation.leadInConfig?.type !== 'none'}
                                <div class="field-group">
                                    <label for="lead-in-length-{operation.id}"
                                        >Length (units):</label
                                    >
                                    <div class="length-with-fit">
                                        <input
                                            id="lead-in-length-{operation.id}"
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={operation.leadInConfig
                                                ?.length || 0}
                                            onchange={(e) =>
                                                updateOperationField(
                                                    operation.id,
                                                    'leadInConfig',
                                                    {
                                                        ...operation.leadInConfig,
                                                        length:
                                                            parseFloat(
                                                                e.currentTarget
                                                                    .value
                                                            ) || 0,
                                                    }
                                                )}
                                            class="lead-input"
                                        />
                                        <label class="fit-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={operation.leadInConfig
                                                    ?.fit || false}
                                                onchange={(e) =>
                                                    updateOperationField(
                                                        operation.id,
                                                        'leadInConfig',
                                                        {
                                                            ...operation.leadInConfig,
                                                            fit: e.currentTarget
                                                                .checked,
                                                        }
                                                    )}
                                                class="fit-checkbox"
                                            />
                                            Fit
                                        </label>
                                    </div>
                                </div>
                                <div class="field-group">
                                    <label for="lead-in-angle-{operation.id}"
                                        >Angle (degrees):</label
                                    >
                                    <input
                                        id="lead-in-angle-{operation.id}"
                                        type="number"
                                        min="0"
                                        max="360"
                                        step="1"
                                        value={operation.leadInConfig?.angle ||
                                            0}
                                        onchange={(e) =>
                                            updateOperationField(
                                                operation.id,
                                                'leadInConfig',
                                                {
                                                    ...operation.leadInConfig,
                                                    angle:
                                                        parseFloat(
                                                            e.currentTarget
                                                                .value
                                                        ) || 0,
                                                }
                                            )}
                                        class="lead-input"
                                        placeholder="Auto"
                                    />
                                </div>
                            {/if}
                        </div>

                        <div class="lead-group">
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
                            {#if operation.leadOutConfig?.type !== 'none'}
                                <div class="field-group">
                                    <label for="lead-out-length-{operation.id}"
                                        >Length (units):</label
                                    >
                                    <div class="length-with-fit">
                                        <input
                                            id="lead-out-length-{operation.id}"
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={operation.leadOutConfig
                                                ?.length || 0}
                                            onchange={(e) =>
                                                updateOperationField(
                                                    operation.id,
                                                    'leadOutConfig',
                                                    {
                                                        ...operation.leadOutConfig,
                                                        length:
                                                            parseFloat(
                                                                e.currentTarget
                                                                    .value
                                                            ) || 0,
                                                    }
                                                )}
                                            class="lead-input"
                                        />
                                        <label class="fit-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={operation.leadOutConfig
                                                    ?.fit || false}
                                                onchange={(e) =>
                                                    updateOperationField(
                                                        operation.id,
                                                        'leadOutConfig',
                                                        {
                                                            ...operation.leadOutConfig,
                                                            fit: e.currentTarget
                                                                .checked,
                                                        }
                                                    )}
                                                class="fit-checkbox"
                                            />
                                            Fit
                                        </label>
                                    </div>
                                </div>
                                <div class="field-group">
                                    <label for="lead-out-angle-{operation.id}"
                                        >Angle (degrees):</label
                                    >
                                    <input
                                        id="lead-out-angle-{operation.id}"
                                        type="number"
                                        min="0"
                                        max="360"
                                        step="1"
                                        value={operation.leadOutConfig?.angle ||
                                            0}
                                        onchange={(e) =>
                                            updateOperationField(
                                                operation.id,
                                                'leadOutConfig',
                                                {
                                                    ...operation.leadOutConfig,
                                                    angle:
                                                        parseFloat(
                                                            e.currentTarget
                                                                .value
                                                        ) || 0,
                                                }
                                            )}
                                        class="lead-input"
                                        placeholder="Auto"
                                    />
                                </div>
                            {/if}
                        </div>
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

                    <!-- Hole Cutting Settings (only for part operations) -->
                    {#if operation.targetType === 'parts'}
                        <div class="hole-cutting-settings">
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
                <p>
                    Operations define how tools are applied to parts or chains.
                </p>
            </div>
        {/if}
    </div>
</div>

<style>
    .operations-container {
        background: #f9f9f9;
        border-radius: 4px;
        padding: 1rem;
    }

    .operations-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-height: 400px;
        overflow-y: auto;
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
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
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
        gap: 1rem;
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .lead-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
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
        width: 100%;
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

    /* Kerf compensation row styling */
    .kerf-compensation-row {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .kerf-compensation-row .field-group {
        max-width: 200px;
    }

    /* Length with fit checkbox styling */
    .length-with-fit {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .length-with-fit .lead-input {
        flex: 1;
    }

    .fit-checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: #6b7280;
        cursor: pointer;
        white-space: nowrap;
    }

    .fit-checkbox {
        margin: 0;
        cursor: pointer;
    }

    .fit-checkbox-label:hover {
        color: #374151;
    }

    /* Hole cutting settings styling */
    .hole-cutting-settings {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        gap: 1rem;
    }

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

    .hole-cutting-settings .field-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
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
