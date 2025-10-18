<script lang="ts">
    import { operationsStore } from '$lib/stores/operations/store';
    import { toolStore } from '$lib/stores/tools/store';
    import type { Tool } from '$lib/cam/tool/interfaces';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { onMount } from 'svelte';
    import type { Operation } from '$lib/stores/operations/interfaces';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import type { DetectedPart } from '$lib/cam/part/interfaces';
    import {
        DEFAULT_CUT_DIRECTION,
        DEFAULT_KERF_COMPENSATION,
        DEFAULT_HOLE_UNDERSPEED,
        DEFAULT_OPERATION_ENABLED,
    } from '$lib/config/operation-defaults';
    import {
        getDefaultLeadInConfig,
        getDefaultLeadOutConfig,
    } from '$lib/config/lead-defaults';
    import OperationsPanel from '$components/panels/OperationsPanel.svelte';
    import { DEFAULT_OPTIMIZE_STARTS } from '$lib/cam/cut/defaults';

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

    export function addNewOperation(options?: { enabled?: boolean }) {
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
            // If nothing is selected and this is the first operation, default to all parts or all chains
            else if (operations.length === 0) {
                if (parts.length > 0) {
                    targetType = 'parts';
                    targetIds = parts.map((p) => p.id);
                } else if (chains.length > 0) {
                    targetType = 'chains';
                    targetIds = chains.map((c) => c.id);
                }
            }
        }

        operationsStore.addOperation({
            name: `Operation ${newOrder}`,
            toolId: $toolStore.length > 0 ? $toolStore[0].id : null,
            targetType,
            targetIds,
            enabled: options?.enabled ?? DEFAULT_OPERATION_ENABLED,
            order: newOrder,
            cutDirection: DEFAULT_CUT_DIRECTION,
            leadInConfig: getDefaultLeadInConfig(), // Unit-aware default
            leadOutConfig: getDefaultLeadOutConfig(), // Unit-aware default
            kerfCompensation:
                targetType === 'parts'
                    ? DEFAULT_KERF_COMPENSATION.forParts
                    : DEFAULT_KERF_COMPENSATION.forChains,
            holeUnderspeedEnabled: DEFAULT_HOLE_UNDERSPEED.enabled,
            holeUnderspeedPercent: DEFAULT_HOLE_UNDERSPEED.percent,
            optimizeStarts: DEFAULT_OPTIMIZE_STARTS,
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

    function selectAllTargets(
        operationId: string,
        targetType: 'parts' | 'chains'
    ) {
        const operation = operations.find((op) => op.id === operationId);
        if (!operation) return;

        // Get all available target IDs based on target type
        const availableTargets =
            targetType === 'parts'
                ? parts.filter(
                      (p) =>
                          !isTargetAssignedToOther(p.id, 'parts', operationId)
                  )
                : chains.filter(
                      (c) =>
                          !isTargetAssignedToOther(c.id, 'chains', operationId)
                  );

        const allTargetIds = availableTargets.map((t) => t.id);

        updateOperationField(operationId, 'targetIds', allTargetIds);
    }

    function clearAllTargets(operationId: string) {
        updateOperationField(operationId, 'targetIds', []);
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

<OperationsPanel
    {operations}
    {chains}
    {parts}
    bind:dragOverIndex
    bind:toolSearchTerms
    bind:showToolDropdowns
    bind:showApplyToMenus
    bind:hoveredPartId
    bind:hoveredChainId
    bind:collapsedOperations
    {availableTools}
    {updateOperationField}
    {deleteOperation}
    {duplicateOperation}
    {toggleTargetSelection}
    {selectAllTargets}
    {clearAllTargets}
    {handleDragStart}
    {handleDragOver}
    {handleDragLeave}
    {handleDrop}
    {getToolName}
    {getFilteredTools}
    {selectTool}
    {toggleToolDropdown}
    {handleToolKeydown}
    {handleApplyToKeydown}
    {toggleApplyToMenu}
    {getSelectedTargetsText}
    {handlePartHover}
    {handleChainHover}
    {isTargetAssignedToOther}
    {toggleOperationCollapse}
/>
