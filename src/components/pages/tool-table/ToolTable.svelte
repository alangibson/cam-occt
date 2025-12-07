<script lang="ts">
    import type { Tool } from '$lib/cam/tool/interfaces';
    import {
        toolStore,
        createDefaultTool,
    } from '$lib/stores/tools/store.svelte';

    // Note: Tool persistence is handled by the main storage system in store.ts
    let tools = $derived(toolStore.tools);
    let draggedTool: Tool | null = $state(null);
    let dragOverIndex: number | null = $state(null);

    function addNewTool() {
        const newToolNumber =
            tools.length > 0
                ? Math.max(...tools.map((t) => t.toolNumber)) + 1
                : 1;

        toolStore.addTool(createDefaultTool(newToolNumber));
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
        // Only update the exact field that was changed
        toolStore.updateTool(id, { [field]: value });
    }
</script>

<div class="tool-table-container">
    <div class="toolbar">
        <h2>Tool Table</h2>
        <button onclick={addNewTool} class="btn btn-primary"> Add Tool </button>
    </div>

    <div class="table-wrapper">
        <div class="tool-grid">
            <!-- Header -->
            <div class="grid-header">
                <div class="header-cell"></div>
                <div class="header-cell">Tool #</div>
                <div class="header-cell">Name</div>
                <div class="header-cell">Feed Rate</div>
                <div class="header-cell">Pierce Height</div>
                <div class="header-cell">Cut Height</div>
                <div class="header-cell">Pierce Delay</div>
                <div class="header-cell">Arc Voltage</div>
                <div class="header-cell">Kerf Width</div>
                <div class="header-cell">THC</div>
                <div class="header-cell">Gas Press.</div>
                <div class="header-cell">Pause End</div>
                <div class="header-cell">Puddle Jump Ht</div>
                <div class="header-cell">Puddle Jump Dly</div>
                <div class="header-cell">Plunge Rate</div>
                <div class="header-cell">Actions</div>
            </div>

            <!-- Tool Rows -->
            {#each tools as tool, index (tool.id)}
                <div
                    class="tool-item"
                    class:drag-over={dragOverIndex === index}
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, tool)}
                    ondragover={(e) => handleDragOver(e, index)}
                    ondragleave={handleDragLeave}
                    ondrop={(e) => handleDrop(e, index)}
                    role="row"
                    tabindex="0"
                >
                    <!-- Drag handle -->
                    <div class="cell drag-handle">☰</div>

                    <!-- Tool # -->
                    <div class="cell">
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
                    </div>

                    <!-- Name -->
                    <div class="cell">
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
                    </div>

                    <!-- Feed Rate -->
                    <div class="cell dual-unit">
                        <div class="unit-row metric">
                            <input
                                type="number"
                                value={(
                                    tool.feedRateMetric ??
                                    tool.feedRate ??
                                    0
                                ).toFixed(1)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'feedRateMetric',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                            <span class="unit-suffix">mm/min</span>
                        </div>
                        <div class="unit-row imperial">
                            <input
                                type="number"
                                value={(
                                    tool.feedRateImperial ??
                                    tool.feedRate ??
                                    0
                                ).toFixed(3)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'feedRateImperial',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.001"
                            />
                            <span class="unit-suffix">in/min</span>
                        </div>
                    </div>

                    <!-- Pierce Height -->
                    <div class="cell dual-unit">
                        <div class="unit-row metric">
                            <input
                                type="number"
                                value={(
                                    tool.pierceHeightMetric ??
                                    tool.pierceHeight ??
                                    0
                                ).toFixed(1)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'pierceHeightMetric',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                            <span class="unit-suffix">mm</span>
                        </div>
                        <div class="unit-row imperial">
                            <input
                                type="number"
                                value={(
                                    tool.pierceHeightImperial ??
                                    tool.pierceHeight ??
                                    0
                                ).toFixed(3)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'pierceHeightImperial',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.001"
                            />
                            <span class="unit-suffix">in</span>
                        </div>
                    </div>

                    <!-- Cut Height -->
                    <div class="cell dual-unit">
                        <div class="unit-row metric">
                            <input
                                type="number"
                                value={(
                                    tool.cutHeightMetric ??
                                    tool.cutHeight ??
                                    0
                                ).toFixed(1)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'cutHeightMetric',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                            <span class="unit-suffix">mm</span>
                        </div>
                        <div class="unit-row imperial">
                            <input
                                type="number"
                                value={(
                                    tool.cutHeightImperial ??
                                    tool.cutHeight ??
                                    0
                                ).toFixed(3)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'cutHeightImperial',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.001"
                            />
                            <span class="unit-suffix">in</span>
                        </div>
                    </div>

                    <!-- Pierce Delay -->
                    <div class="cell">
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
                        <span class="unit-suffix">sec</span>
                    </div>

                    <!-- Arc Voltage -->
                    <div class="cell">
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
                        <span class="unit-suffix">V</span>
                    </div>

                    <!-- Kerf Width -->
                    <div class="cell dual-unit">
                        <div class="unit-row metric">
                            <input
                                type="number"
                                value={(
                                    tool.kerfWidthMetric ??
                                    tool.kerfWidth ??
                                    0
                                ).toFixed(2)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'kerfWidthMetric',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.01"
                            />
                            <span class="unit-suffix">mm</span>
                        </div>
                        <div class="unit-row imperial">
                            <input
                                type="number"
                                value={(
                                    tool.kerfWidthImperial ??
                                    tool.kerfWidth ??
                                    0
                                ).toFixed(3)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'kerfWidthImperial',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.001"
                            />
                            <span class="unit-suffix">in</span>
                        </div>
                    </div>

                    <!-- THC -->
                    <div class="cell">
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
                    </div>

                    <!-- Gas Pressure -->
                    <div class="cell">
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
                        <span class="unit-suffix">bar</span>
                    </div>

                    <!-- Pause End -->
                    <div class="cell">
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
                        <span class="unit-suffix">sec</span>
                    </div>

                    <!-- Puddle Jump Height -->
                    <div class="cell dual-unit">
                        <div class="unit-row metric">
                            <input
                                type="number"
                                value={(
                                    tool.puddleJumpHeightMetric ??
                                    tool.puddleJumpHeight ??
                                    0
                                ).toFixed(1)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'puddleJumpHeightMetric',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                            <span class="unit-suffix">mm</span>
                        </div>
                        <div class="unit-row imperial">
                            <input
                                type="number"
                                value={(
                                    tool.puddleJumpHeightImperial ??
                                    tool.puddleJumpHeight ??
                                    0
                                ).toFixed(3)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'puddleJumpHeightImperial',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.001"
                            />
                            <span class="unit-suffix">in</span>
                        </div>
                    </div>

                    <!-- Puddle Jump Delay -->
                    <div class="cell">
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
                        <span class="unit-suffix">sec</span>
                    </div>

                    <!-- Plunge Rate -->
                    <div class="cell dual-unit">
                        <div class="unit-row metric">
                            <input
                                type="number"
                                value={(
                                    tool.plungeRateMetric ??
                                    tool.plungeRate ??
                                    0
                                ).toFixed(1)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'plungeRateMetric',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.1"
                            />
                            <span class="unit-suffix">mm/min</span>
                        </div>
                        <div class="unit-row imperial">
                            <input
                                type="number"
                                value={(
                                    tool.plungeRateImperial ??
                                    tool.plungeRate ??
                                    0
                                ).toFixed(3)}
                                onchange={(e) =>
                                    updateToolField(
                                        tool.id,
                                        'plungeRateImperial',
                                        parseFloat(e.currentTarget.value)
                                    )}
                                class="input-xs"
                                step="0.001"
                            />
                            <span class="unit-suffix">in/min</span>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="cell actions-cell">
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
                    </div>
                </div>
            {/each}
        </div>
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
        background: white;
    }

    .tool-grid {
        display: flex;
        flex-direction: column;
        min-width: fit-content;
        --grid-columns: 2rem 4rem 6rem repeat(13, minmax(6rem, 1fr));
    }

    .grid-header {
        display: grid;
        grid-template-columns: var(--grid-columns);
        gap: 0;
        background: #f3f4f6;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .header-cell {
        padding: 0.25rem;
        text-align: left;
        font-weight: 600;
        font-size: 0.75rem;
        white-space: normal;
        line-height: 1.2;
        border-right: 1px solid #e5e7eb;
        overflow: hidden;
    }

    .header-cell:last-child {
        border-right: none;
    }

    .tool-item {
        display: grid;
        grid-template-columns: var(--grid-columns);
        gap: 0;
        border-bottom: 2px solid #d1d5db;
    }

    .tool-item:hover {
        background: #f9fafb;
    }

    .tool-item.drag-over {
        background: #e6f2ff;
    }

    .cell {
        padding: 0.25rem;
        border-right: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        white-space: nowrap;
    }

    .cell:last-child {
        border-right: none;
    }

    .cell.dual-unit {
        flex-direction: column;
        align-items: stretch;
        padding: 0;
        gap: 0;
    }

    .unit-row {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.125rem 0.25rem;
        flex: 1;
    }

    .unit-row.metric {
        border-bottom: 1px solid #e5e7eb;
    }

    .unit-row.imperial {
        background: #fafafa;
    }

    .drag-handle {
        cursor: move;
        color: #6b7280;
        font-size: 1rem;
        justify-content: center;
    }

    input[type='number'],
    input[type='text'] {
        flex: 1;
        padding: 0.125rem 0.25rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        min-width: 0;
    }

    input[type='checkbox'] {
        cursor: pointer;
    }

    .input-xs {
        max-width: 4rem;
    }

    .input-sm {
        max-width: 6rem;
    }

    .unit-suffix {
        font-size: 0.7rem;
        color: #6b7280;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .actions-cell {
        gap: 0.125rem;
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
</style>
