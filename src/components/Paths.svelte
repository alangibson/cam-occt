<script lang="ts">
    import { pathStore } from '$lib/stores/paths/store';
    import { operationsStore } from '$lib/stores/operations/store';
    import { toolStore } from '$lib/stores/tools/store';
    import { flip } from 'svelte/animate';
    import type { Path } from '$lib/stores/paths/interfaces';

    let paths: Path[] = [];
    let selectedPathId: string | null = null;
    let highlightedPathId: string | null = null;
    let draggedPath: Path | null = null;
    let dragOverIndex: number | null = null;

    // Subscribe to stores
    pathStore.subscribe((state) => {
        paths = state.paths;
        selectedPathId = state.selectedPathId;
        highlightedPathId = state.highlightedPathId;
    });

    // Paths are now handled by the main persistence system
    // No need for component-level localStorage anymore

    function handlePathClick(pathId: string) {
        if (selectedPathId === pathId) {
            pathStore.selectPath(null); // Deselect if already selected
        } else {
            pathStore.selectPath(pathId);
        }
    }

    function handlePathHover(pathId: string | null) {
        highlightedPathId = pathId;
        if (pathId) {
            pathStore.highlightPath(pathId);
        } else {
            pathStore.clearHighlight();
        }
    }

    // Drag and drop functions
    function handleDragStart(event: DragEvent, path: Path) {
        draggedPath = path;
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
        if (!draggedPath) return;

        const draggedIndex = paths.findIndex((p) => p.id === draggedPath!.id);
        if (draggedIndex === -1) return;

        const newPaths = [...paths];
        newPaths.splice(draggedIndex, 1);
        newPaths.splice(dropIndex, 0, draggedPath);

        // Update order values
        newPaths.forEach((path, index) => {
            path.order = index + 1;
        });

        pathStore.reorderPaths(newPaths);
        draggedPath = null;
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

<div class="paths-container">
    <div class="paths-list">
        {#each paths as path, index (path.id)}
            <div
                class="path-item {dragOverIndex === index
                    ? 'drag-over'
                    : ''} {selectedPathId === path.id
                    ? 'selected'
                    : ''} {highlightedPathId === path.id ? 'highlighted' : ''}"
                role="button"
                data-path-id={path.id}
                draggable="true"
                ondragstart={(e) => handleDragStart(e, path)}
                ondragover={(e) => handleDragOver(e, index)}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, index)}
                onmouseenter={() => handlePathHover(path.id)}
                onmouseleave={() => handlePathHover(null)}
                onclick={() => handlePathClick(path.id)}
                onkeydown={(e) =>
                    (e.key === 'Enter' || e.key === ' ') &&
                    handlePathClick(path.id)}
                tabindex="0"
                animate:flip={{ duration: 200 }}
            >
                <div class="path-header">
                    <span class="drag-handle">☰</span>
                    <span class="path-name">{path.name}</span>
                </div>

                <div class="path-details">
                    <div class="path-info">
                        <span class="operation-name"
                            >{getOperationName(path.operationId)}</span
                        >
                        <span class="tool-name">{getToolName(path.toolId)}</span
                        >
                        <span class="cut-direction {path.cutDirection}"
                            >{getCutDirectionDisplay(path.cutDirection)}</span
                        >
                    </div>
                    <div class="path-order">#{path.order}</div>
                </div>
            </div>
        {/each}

        {#if paths.length === 0}
            <div class="no-paths">
                <p>No paths generated yet.</p>
                <p>
                    Apply operations to chains or parts to generate tool paths.
                </p>
            </div>
        {/if}
    </div>
</div>

<style>
    .paths-container {
    }

    .paths-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
    }

    .path-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .path-item:hover {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .path-item.drag-over {
        background: #e6f2ff;
        border-color: rgb(0, 83, 135);
    }

    .path-item.selected {
        background: #e6f2ff;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.2);
    }

    .path-item.highlighted {
        background: #e6f2f0;
        border-color: rgb(0, 133, 84);
    }

    .path-header {
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

    .path-name {
        flex: 1;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .path-details {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .path-info {
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

    .path-order {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 600;
        background: #f3f4f6;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
    }

    .no-paths {
        text-align: center;
        color: #6b7280;
        font-size: 0.875rem;
        padding: 2rem;
    }

    .no-paths p {
        margin: 0.5rem 0;
    }
</style>
