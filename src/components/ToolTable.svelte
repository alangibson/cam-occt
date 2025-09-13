<script lang="ts">
    import { toolStore, type Tool } from '$lib/stores/tools/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { flip } from 'svelte/animate';
    import { onMount } from 'svelte';

    let tools: Tool[] = [];
    let draggedTool: Tool | null = null;
    let dragOverIndex: number | null = null;
    let displayUnit: 'mm' | 'inch' = 'mm';

    // Subscribe to drawing store for display unit
    drawingStore.subscribe((state) => {
        displayUnit = state.displayUnit;
    });

    // Load tools from localStorage on mount
    onMount(() => {
        const savedTools = localStorage.getItem('metalheadcam-tools');
        if (savedTools) {
            try {
                const parsedTools = JSON.parse(savedTools);
                toolStore.reorderTools(parsedTools);
            } catch (e) {
                console.error('Failed to load tools from localStorage:', e);
            }
        } else {
            // Add a default tool only if no saved tools
            addNewTool();
        }
    });

    // Subscribe to tool store and save to localStorage
    toolStore.subscribe((value) => {
        tools = value;
        // Save to localStorage whenever tools change
        if (typeof window !== 'undefined' && value.length > 0) {
            localStorage.setItem('metalheadcam-tools', JSON.stringify(value));
        }
    });

    function addNewTool() {
        const newToolNumber =
            tools.length > 0
                ? Math.max(...tools.map((t) => t.toolNumber)) + 1
                : 1;

        toolStore.addTool({
            toolNumber: newToolNumber,
            toolName: `Tool ${newToolNumber}`,
            feedRate: 100,
            rapidRate: 3000,
            pierceHeight: 3.8,
            cutHeight: 1.5,
            pierceDelay: 0.5,
            arcVoltage: 120,
            kerfWidth: 1.5,
            thcEnable: true,
            gasPressure: 4.5,
            pauseAtEnd: 0,
            puddleJumpHeight: 50,
            puddleJumpDelay: 0,
            plungeRate: 500,
        });
    }

    function deleteTool(id: string) {
        toolStore.deleteTool(id);
    }

    function duplicateTool(tool: Tool) {
        const newToolNumber =
            tools.length > 0
                ? Math.max(...tools.map((t) => t.toolNumber)) + 1
                : 1;

        toolStore.addTool({
            ...tool,
            toolNumber: newToolNumber,
            toolName: `${tool.toolName} (Copy)`,
        });
    }

    function handleDragStart(event: DragEvent, tool: Tool) {
        draggedTool = tool;
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
        if (!draggedTool) return;

        const draggedIndex = tools.findIndex((t) => t.id === draggedTool!.id);
        if (draggedIndex === -1) return;

        const newTools = [...tools];
        newTools.splice(draggedIndex, 1);
        newTools.splice(dropIndex, 0, draggedTool);

        toolStore.reorderTools(newTools);
        draggedTool = null;
        dragOverIndex = null;
    }

    function updateToolField(
        id: string,
        field: keyof Tool,
        value: string | number | boolean
    ) {
        toolStore.updateTool(id, { [field]: value });
    }
</script>

<div class="tool-table-container">
    <div class="toolbar">
        <h2>Tool Table</h2>
        <button onclick={addNewTool} class="btn btn-primary"> Add Tool </button>
    </div>

    <div class="table-wrapper">
        <table class="tool-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Tool #</th>
                    <th>Name</th>
                    <th>Feed Rate<br />({displayUnit}/min)</th>
                    <th>Rapid Rate<br />({displayUnit}/min)</th>
                    <th>Pierce<br />Height<br />({displayUnit})</th>
                    <th>Cut<br />Height<br />({displayUnit})</th>
                    <th>Pierce<br />Delay<br />(sec)</th>
                    <th>Arc<br />Voltage<br />(V)</th>
                    <th>Kerf<br />Width<br />({displayUnit})</th>
                    <th>THC</th>
                    <th>Gas<br />Press.<br />(bar)</th>
                    <th>Pause<br />End<br />(sec)</th>
                    <th>Puddle<br />Jump Ht<br />({displayUnit})</th>
                    <th>Puddle<br />Jump Dly<br />(sec)</th>
                    <th>Plunge<br />Rate<br />({displayUnit}/min)</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each tools as tool, index (tool.id)}
                    <tr
                        class:drag-over={dragOverIndex === index}
                        draggable="true"
                        ondragstart={(e) => handleDragStart(e, tool)}
                        ondragover={(e) => handleDragOver(e, index)}
                        ondragleave={handleDragLeave}
                        ondrop={(e) => handleDrop(e, index)}
                        animate:flip={{ duration: 200 }}
                    >
                        <td class="drag-handle">☰</td>
                        <td>
                            <input
                                type="number"
                                value={tool.toolNumber}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'toolNumber',
                                        parseInt(e.currentTarget.value)
                                    )}
                                class="input-xs"
                            />
                        </td>
                        <td>
                            <input
                                type="text"
                                value={tool.toolName}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'toolName',
                                        e.currentTarget.value
                                    )}
                                class="input-sm"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.feedRate}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'feedRate',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.rapidRate}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'rapidRate',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.pierceHeight}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'pierceHeight',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.cutHeight}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'cutHeight',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.pierceDelay}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'pierceDelay',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.arcVoltage}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'arcVoltage',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.kerfWidth}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'kerfWidth',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.01"
                            />
                        </td>
                        <td>
                            <input
                                type="checkbox"
                                checked={tool.thcEnable}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'thcEnable',
                                        e.currentTarget.checked
                                    )}
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.gasPressure}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'gasPressure',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.pauseAtEnd}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'pauseAtEnd',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.puddleJumpHeight}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'puddleJumpHeight',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.puddleJumpDelay}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'puddleJumpDelay',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={tool.plungeRate}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'plungeRate',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                        </td>
                        <td class="actions-cell">
                            <button
                                onclick={() => duplicateTool(tool)}
                                class="btn btn-primary btn-small"
                                title="Duplicate tool"
                            >
                                ⎘
                            </button>
                            <button
                                onclick={() => deleteTool(tool.id)}
                                class="btn btn-danger btn-small"
                                title="Delete tool"
                            >
                                ✕
                            </button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    .tool-table-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 1rem;
        box-sizing: border-box;
    }

    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .toolbar h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .table-wrapper {
        flex: 1;
        overflow-x: auto;
        overflow-y: auto;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        max-width: 100%;
    }

    .tool-table {
        width: auto;
        min-width: 100%;
        border-collapse: collapse;
        background: white;
    }

    .tool-table th {
        background: #f3f4f6;
        padding: 0.25rem;
        text-align: left;
        font-weight: 600;
        font-size: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 10;
        white-space: normal;
        line-height: 1.2;
    }

    .tool-table td {
        padding: 0.25rem;
        border-bottom: 1px solid #e5e7eb;
    }

    .tool-table tr:hover {
        background: #f9fafb;
    }

    .tool-table tr.drag-over {
        background: #e6f2ff;
    }

    .drag-handle {
        cursor: move;
        color: #6b7280;
        font-size: 1rem;
        text-align: center;
        width: 1.5rem;
        padding: 0.125rem;
    }

    input[type='number'],
    input[type='text'] {
        width: 100%;
        padding: 0.125rem 0.25rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.75rem;
    }

    input[type='checkbox'] {
        cursor: pointer;
    }

    .input-xs {
        width: 2.5rem;
        min-width: 2rem;
    }

    .input-sm {
        width: 4rem;
        min-width: 3rem;
    }

    .btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .btn-primary {
        background: rgb(0, 83, 135);
        color: white;
    }

    .btn-primary:hover {
        background: rgb(0, 83, 135);
    }

    .btn-danger {
        background: rgb(133, 18, 0);
        color: white;
    }

    .btn-danger:hover {
        background: rgb(133, 18, 0);
    }

    .btn-small {
        padding: 0.125rem 0.25rem;
        font-size: 0.65rem;
        min-width: 1.5rem;
    }

    .actions-cell {
        white-space: nowrap;
    }

    .actions-cell button {
        margin: 0 0.125rem;
    }
</style>
