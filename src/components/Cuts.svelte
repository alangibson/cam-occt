<script lang="ts">
    import { cutStore } from '$lib/stores/cuts/store';
    import { operationsStore } from '$lib/stores/operations/store';
    import { toolStore } from '$lib/stores/tools/store';
    import { flip } from 'svelte/animate';
    import type { Cut } from '$lib/cam/cut/interfaces';

    let cuts: Cut[] = [];
    let selectedCutId: string | null = null;
    let highlightedCutId: string | null = null;
    let draggedCut: Cut | null = null;
    let dragOverIndex: number | null = null;

    // Subscribe to stores
    cutStore.subscribe((state) => {
        cuts = state.cuts;
        selectedCutId = state.selectedCutId;
        highlightedCutId = state.highlightedCutId;
    });

    // Cuts are now handled by the main persistence system
    // No need for component-level localStorage anymore

    function handleCutClick(cutId: string) {
        if (selectedCutId === cutId) {
            cutStore.selectCut(null); // Deselect if already selected
        } else {
            cutStore.selectCut(cutId);
        }
    }

    function handleCutHover(cutId: string | null) {
        highlightedCutId = cutId;
        if (cutId) {
            cutStore.highlightCut(cutId);
        } else {
            cutStore.clearHighlight();
        }
    }

    // Drag and drop functions
    function handleDragStart(event: DragEvent, cut: Cut) {
        draggedCut = cut;
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
        if (!draggedCut) return;

        const draggedIndex = cuts.findIndex((c) => c.id === draggedCut!.id);
        if (draggedIndex === -1) return;

        const newCuts = [...cuts];
        newCuts.splice(draggedIndex, 1);
        newCuts.splice(dropIndex, 0, draggedCut);

        // Update order values
        newCuts.forEach((cut, index) => {
            cut.order = index + 1;
        });

        cutStore.reorderCuts(newCuts);
        draggedCut = null;
        dragOverIndex = null;
    }

    function getToolName(toolId: string | null): string {
        if (!toolId) return 'No Tool';
        const tool = $toolStore.find((t) => t.id === toolId);
        return tool ? tool.toolName : 'Unknown Tool';
    }

    function getOperationName(operationId: string): string {
        const operations = $operationsStore || [];
        const operation = operations.find((op) => op.id === operationId);
        return operation ? operation.name : 'Unknown Operation';
    }

    function getCutDirectionDisplay(cutDirection: string): string {
        switch (cutDirection) {
            case 'clockwise':
                return '↻ CW';
            case 'counterclockwise':
                return '↺ CCW';
            case 'none':
                return '— None';
            default:
                return '? Unknown';
        }
    }
</script>

<div class="cuts-container">
    <div class="cuts-list">
        {#each cuts as cut, index (cut.id)}
            <div
                class="cut-item {dragOverIndex === index
                    ? 'drag-over'
                    : ''} {selectedCutId === cut.id
                    ? 'selected'
                    : ''} {highlightedCutId === cut.id ? 'highlighted' : ''}"
                role="button"
                data-cut-id={cut.id}
                draggable="true"
                ondragstart={(e) => handleDragStart(e, cut)}
                ondragover={(e) => handleDragOver(e, index)}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, index)}
                onmouseenter={() => handleCutHover(cut.id)}
                onmouseleave={() => handleCutHover(null)}
                onclick={() => handleCutClick(cut.id)}
                onkeydown={(e) =>
                    (e.key === 'Enter' || e.key === ' ') &&
                    handleCutClick(cut.id)}
                tabindex="0"
                animate:flip={{ duration: 200 }}
            >
                <div class="cut-header">
                    <span class="drag-handle">☰</span>
                    <span class="cut-name">{cut.name}</span>
                </div>

                <div class="cut-details">
                    <div class="cut-info">
                        <span class="operation-name"
                            >{getOperationName(cut.operationId)}</span
                        >
                        <span class="tool-name">{getToolName(cut.toolId)}</span>
                        <span class="cut-direction {cut.cutDirection}"
                            >{getCutDirectionDisplay(cut.cutDirection)}</span
                        >
                    </div>
                    <div class="cut-order">#{cut.order}</div>
                </div>
            </div>
        {/each}

        {#if cuts.length === 0}
            <div class="no-cuts">
                <p>No cuts generated yet.</p>
                <p>
                    Apply operations to chains or parts to generate tool cuts.
                </p>
            </div>
        {/if}
    </div>
</div>

<style>
    .cuts-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
    }

    .cut-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cut-item:hover {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .cut-item.drag-over {
        background: #e6f2ff;
        border-color: rgb(0, 83, 135);
    }

    .cut-item.selected {
        background: #e6f2ff;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }

    .cut-item.highlighted {
        background: #e6f2f0;
        border-color: rgb(0, 133, 84);
    }

    .cut-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .drag-handle {
        cursor: move;
        color: #6b7280;
        font-size: 1rem;
    }

    .cut-name {
        flex: 1;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .cut-details {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .cut-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .operation-name {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 500;
    }

    .tool-name {
        font-size: 0.75rem;
        color: #374151;
    }

    .cut-direction {
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        white-space: nowrap;
    }

    .cut-direction.clockwise {
        background: #fef3c7;
        color: #92400e;
    }

    .cut-direction.counterclockwise {
        background: #e6f2f0;
        color: #166534;
    }

    .cut-direction.none {
        background: #f3f4f6;
        color: #6b7280;
    }

    .cut-order {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 600;
        background: #f3f4f6;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
    }

    .no-cuts {
        text-align: center;
        color: #6b7280;
        font-size: 0.875rem;
        padding: 2rem;
    }

    .no-cuts p {
        margin: 0.5rem 0;
    }
</style>
