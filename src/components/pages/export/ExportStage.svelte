<script lang="ts">
    import GCodeExport from './GCodeExport.svelte';
    import AccordionPanel from '$components/panels/AccordionPanel.svelte';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import type { CuttingParameters } from '$lib/cam/gcode-generator/interfaces';
    import { settingsStore } from '$lib/stores/settings/store';
    import { onMount } from 'svelte';

    // Resizable columns state
    let sideColumnWidth = 280; // Default width in pixels
    let isDraggingSide = false;
    let startX = 0;
    let startWidth = 0;

    // Default cutting parameters for G-code generation
    let _cuttingParameters: CuttingParameters = {
        feedRate: 1000,
        pierceHeight: 3.8,
        pierceDelay: 0.5,
        cutHeight: 1.5,
        kerf: 1.5,
    };

    // G-code generation options with localStorage persistence
    let includeComments = true;
    let adaptiveFeedControl: boolean | null = true;
    let enableTHC: boolean | null = true;
    let settingsLoaded = false; // Flag to prevent saving during initial load

    function handleStartOver() {
        workflowStore.reset();
        workflowStore.setStage(WorkflowStage.IMPORT);
    }

    // Auto-complete export stage
    workflowStore.completeStage(WorkflowStage.EXPORT);

    // Load settings from localStorage on mount
    onMount(() => {
        const savedSideWidth = localStorage.getItem(
            'metalheadcam-export-side-column-width'
        );
        const savedIncludeComments = localStorage.getItem(
            'metalheadcam-gcode-include-comments'
        );
        const savedAdaptiveFeedControl = localStorage.getItem(
            'metalheadcam-gcode-adaptive-feed-control'
        );
        const savedEnableTHC = localStorage.getItem(
            'metalheadcam-gcode-enable-thc'
        );

        if (savedSideWidth) {
            sideColumnWidth = parseInt(savedSideWidth, 10);
        }

        if (savedIncludeComments !== null) {
            includeComments = savedIncludeComments === 'true';
        }

        if (savedAdaptiveFeedControl !== null) {
            if (savedAdaptiveFeedControl === 'null') {
                adaptiveFeedControl = null;
            } else {
                adaptiveFeedControl = savedAdaptiveFeedControl === 'true';
            }
        }

        if (savedEnableTHC !== null) {
            if (savedEnableTHC === 'null') {
                enableTHC = null;
            } else {
                enableTHC = savedEnableTHC === 'true';
            }
        }

        // Mark settings as loaded so reactive statements can start saving
        settingsLoaded = true;
    });

    // Save settings to localStorage
    function saveColumnWidths() {
        localStorage.setItem(
            'metalheadcam-export-side-column-width',
            sideColumnWidth.toString()
        );
    }

    function saveGCodeSettings() {
        localStorage.setItem(
            'metalheadcam-gcode-include-comments',
            includeComments.toString()
        );
        localStorage.setItem(
            'metalheadcam-gcode-adaptive-feed-control',
            adaptiveFeedControl === null
                ? 'null'
                : adaptiveFeedControl.toString()
        );
        localStorage.setItem(
            'metalheadcam-gcode-enable-thc',
            enableTHC === null ? 'null' : enableTHC.toString()
        );
    }

    // Side column resize handlers
    function handleSideResizeStart(e: MouseEvent) {
        isDraggingSide = true;
        startX = e.clientX;
        startWidth = sideColumnWidth;
        document.addEventListener('mousemove', handleSideResize);
        document.addEventListener('mouseup', handleSideResizeEnd);
        e.preventDefault();
    }

    function handleSideResize(e: MouseEvent) {
        if (!isDraggingSide) return;
        const deltaX = startX - e.clientX; // Reverse delta for right column
        const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
        sideColumnWidth = newWidth;
    }

    function handleSideResizeEnd() {
        isDraggingSide = false;
        document.removeEventListener('mousemove', handleSideResize);
        document.removeEventListener('mouseup', handleSideResizeEnd);
        saveColumnWidths();
    }

    // Keyboard support for resize handles
    function handleSideKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowLeft') {
            sideColumnWidth = Math.min(600, sideColumnWidth + 10);
            saveColumnWidths();
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            sideColumnWidth = Math.max(200, sideColumnWidth - 10);
            saveColumnWidths();
            e.preventDefault();
        }
    }

    // Save G-code settings to localStorage whenever they change (only after initial load)
    $: if (settingsLoaded && typeof includeComments !== 'undefined') {
        saveGCodeSettings();
    }

    $: if (settingsLoaded && typeof adaptiveFeedControl !== 'undefined') {
        saveGCodeSettings();
    }

    $: if (settingsLoaded && typeof enableTHC !== 'undefined') {
        saveGCodeSettings();
    }
</script>

<div class="export-stage">
    <div class="export-layout" class:no-select={isDraggingSide}>
        <!-- Main Content -->
        <div class="main-column">
            <GCodeExport
                {includeComments}
                cutterCompensation={$settingsStore.settings.camSettings
                    .cutterCompensation}
                {adaptiveFeedControl}
                {enableTHC}
            />
        </div>

        <!-- Side Panel -->
        <div class="side-column" style="width: {sideColumnWidth}px;">
            <!-- Side resize handle -->
            <button
                class="resize-handle resize-handle-left"
                on:mousedown={handleSideResizeStart}
                on:keydown={handleSideKeydown}
                class:dragging={isDraggingSide}
                aria-label="Resize side panel (Arrow keys to adjust)"
                type="button"
            ></button>

            <AccordionPanel title="G-Code Settings" isExpanded={true}>
                <div class="settings-content">
                    <div class="setting-item">
                        <label class="setting-label">
                            <input
                                type="checkbox"
                                bind:checked={includeComments}
                            />
                            <span>Include Comments</span>
                        </label>
                    </div>

                    <div class="setting-item">
                        <label
                            class="setting-label-text"
                            for="adaptive-feed-select"
                            >Adaptive Feed Control</label
                        >
                        <select
                            id="adaptive-feed-select"
                            class="setting-select"
                            bind:value={adaptiveFeedControl}
                        >
                            <option value={true}>Enabled (M52 P1)</option>
                            <option value={false}>Disabled (M52 P0)</option>
                            <option value={null}>No G-code</option>
                        </select>
                        <span class="setting-help"
                            >Allow hole feed rate reduction and motion during
                            cut recovery</span
                        >
                    </div>

                    <div class="setting-item">
                        <label class="setting-label-text" for="thc-select"
                            >Torch Height Control (THC)</label
                        >
                        <select
                            id="thc-select"
                            class="setting-select"
                            bind:value={enableTHC}
                        >
                            <option value={true}>Enabled (M65 P2)</option>
                            <option value={false}>Disabled (M64 P2)</option>
                            <option value={null}>No G-code</option>
                        </select>
                        <span class="setting-help"
                            >Torch Height Control enable/disable</span
                        >
                    </div>
                </div>
            </AccordionPanel>

            <AccordionPanel title="Start New Project" isExpanded={true}>
                <div class="workflow-content">
                    <button class="restart-button" on:click={handleStartOver}>
                        Import New Drawing
                    </button>
                    <p class="restart-help">
                        Start a new CAM workflow with a different drawing file.
                    </p>
                </div>
            </AccordionPanel>
        </div>
    </div>
</div>

<style>
    .export-stage {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #f8f9fa;
    }

    .export-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
    }

    .main-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        background-color: white;
        border-right: 1px solid #e5e7eb;
        padding: 0;
        overflow: hidden;
    }

    .side-column {
        background-color: #f5f5f5;
        padding: 1rem;
        overflow-y: auto;
        display: flex;
        flex-shrink: 0; /* Prevent column from shrinking */
        position: relative; /* For resize handle positioning */
        flex-direction: column;
        gap: 1rem;
    }

    /* Removed .panel and .panel-title styles - now handled by AccordionPanel component */

    .workflow-content {
        background: linear-gradient(
            135deg,
            rgb(0, 83, 135) 0%,
            rgb(0, 83, 135) 100%
        );
        color: white;
        border-radius: 0.5rem;
        padding: 1rem;
    }

    /* Removed .workflow-panel styles - now handled by workflow-content within AccordionPanel */

    .restart-button {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 0.5rem;
    }

    .restart-button:hover {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
    }

    .restart-help {
        margin: 0;
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.9);
        line-height: 1.4;
    }

    /* Settings styles */
    .settings-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .setting-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .setting-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
        user-select: none;
    }

    .setting-label input[type='checkbox'] {
        cursor: pointer;
    }

    .setting-label span {
        font-weight: 500;
    }

    .setting-label-text {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        margin-bottom: 0.25rem;
    }

    .setting-select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        background-color: white;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
    }

    .setting-select:hover {
        border-color: #9ca3af;
    }

    .setting-select:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.1);
    }

    .setting-help {
        font-size: 0.75rem;
        color: #6b7280;
        margin-left: 1.5rem;
    }

    /* Resize handle styles */
    .resize-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 6px;
        cursor: col-resize;
        background: transparent;
        border: none;
        padding: 0;
        z-index: 10;
        transition: background-color 0.2s ease;
    }

    .resize-handle:hover {
        background-color: rgb(0, 83, 135);
        opacity: 0.3;
    }

    .resize-handle.dragging {
        background-color: rgb(0, 83, 135);
        opacity: 0.5;
    }

    .resize-handle-left {
        left: -3px; /* Half of width to center on border */
    }

    /* Prevent text selection during resize */
    .export-layout.no-select {
        user-select: none;
    }

    /* Responsive design */
    @media (max-width: 768px) {
        .export-layout {
            flex-direction: column;
        }

        .side-column {
            width: 100% !important; /* Override dynamic width on mobile */
            height: auto;
            max-height: 300px;
        }

        /* Hide resize handles on mobile */
        .resize-handle {
            display: none;
        }
    }
</style>
