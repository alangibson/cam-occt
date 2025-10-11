<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { toolStore } from '$lib/stores/tools/store';
    import { SvelteMap } from 'svelte/reactivity';
    import { CutterCompensation } from '$lib/types/cam';
    import { onMount, createEventDispatcher } from 'svelte';
    import { cutsToToolPaths } from '$lib/cam/cut-generator/cut-to-toolpath';
    import { generateGCode } from '$lib/cam/gcode-generator/gcode-generator';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
    import type { Shape } from '$lib/geometry/shape';

    // Props from parent component
    export let includeComments: boolean = true;
    export let cutterCompensation: CutterCompensation | null =
        CutterCompensation.NONE;
    export let adaptiveFeedControl: boolean | null = true;
    export let enableTHC: boolean | null = true;

    const _dispatch = createEventDispatcher();

    $: drawing = $drawingStore.drawing;
    $: displayUnit = $drawingStore.displayUnit;
    $: cuts = $cutStore.cuts;
    $: chains = $chainStore.chains;
    $: parts = $partStore.parts;
    $: tools = $toolStore;

    let generatedGCode = '';
    let isGenerating = false;

    async function handleGenerateGCode() {
        if (!drawing) {
            console.log('No drawing available for G-code generation');
            return;
        }

        isGenerating = true;
        generatedGCode = '';

        try {
            // Create maps for chain and part data (simulation's approach)
            const chainShapes = new SvelteMap<string, Shape[]>();
            const chainMap = new SvelteMap<string, Chain>();
            chains.forEach((chain) => {
                chainShapes.set(chain.id, chain.shapes);
                chainMap.set(chain.id, chain);
            });

            const partMap = new SvelteMap<string, DetectedPart>();
            parts.forEach((part) => {
                // Map parts by their shell chain ID for lead fitting
                if (part.shell && part.shell.id) {
                    partMap.set(part.shell.id, part);
                }
            });

            // Convert cuts to tool paths using simulation's validated approach
            // This handles empty cuts array gracefully
            const toolPaths = await cutsToToolPaths(
                cuts,
                chainShapes,
                tools,
                cutterCompensation,
                chainMap,
                partMap
            );

            // Generate G-code with settings from props
            // The generateGCode function can handle empty toolPaths and will still generate header/footer
            const gcode = generateGCode(toolPaths, drawing, {
                units: displayUnit,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments,
                cutterCompensation,
                adaptiveFeedControl,
                enableTHC,
                useNativeSplines: true, // Enable G2/G3 arc commands for circles and arcs
            });

            // Display the generated G-code
            generatedGCode = gcode;
        } catch (error) {
            console.error('Error generating G-code:', error);
            console.error(
                'Error generating G-code. Please check the console for details.'
            );
        } finally {
            isGenerating = false;
        }
    }

    function downloadGCode() {
        if (!generatedGCode) return;

        const blob = new Blob([generatedGCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${$drawingStore.fileName?.replace(/\.[^/.]+$/, '') || 'output'}.ngc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function copyToClipboard() {
        if (!generatedGCode) return;

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard
                .writeText(generatedGCode)
                .then(() => {
                    console.log('G-code copied to clipboard!');
                })
                .catch((err) => {
                    console.error('Failed to copy G-code:', err);
                });
        } else {
            console.error('Clipboard API not available');
        }
    }

    // Automatically generate G-code when component mounts or props change
    onMount(() => {
        // Small delay to ensure all stores are loaded after page refresh
        setTimeout(() => {
            handleGenerateGCode();
        }, 100);
    });

    // Regenerate when settings or display units change
    $: if (drawing) {
        // Include all props and display units in the reactive dependencies
        void (
            includeComments &&
            cutterCompensation &&
            adaptiveFeedControl &&
            enableTHC
        );
        void displayUnit; // Watch for display unit changes
        void cuts; // Watch for cut changes
        handleGenerateGCode();
    }
</script>

<div class="export-container">
    {#if !generatedGCode && isGenerating}
        <div class="generate-section">
            <div class="generating-indicator">
                <div class="spinner"></div>
                <p>Generating G-code...</p>
            </div>
        </div>
    {:else if generatedGCode}
        <div class="gcode-section">
            <div class="gcode-header">
                <div class="gcode-info">
                    <span class="gcode-stats">
                        {generatedGCode.split('\n').length} lines • {(
                            new Blob([generatedGCode]).size / 1024
                        ).toFixed(2)} KB
                    </span>
                </div>
                <div class="gcode-actions">
                    <button class="action-button" on:click={copyToClipboard}>
                        Copy to Clipboard
                    </button>
                    <button
                        class="action-button download-button"
                        on:click={downloadGCode}
                    >
                        Download
                    </button>
                    <button
                        class="action-button regenerate-button"
                        on:click={handleGenerateGCode}
                    >
                        Regenerate
                    </button>
                </div>
            </div>

            <div class="gcode-content">
                <textarea
                    class="gcode-textarea"
                    value={generatedGCode}
                    readonly
                    spellcheck="false"
                ></textarea>
            </div>
        </div>
    {:else}
        <div class="generate-section">
            <div class="error-message">
                <p>No cuts available. Please create operations first.</p>
            </div>
        </div>
    {/if}
</div>

<style>
    .export-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: white;
    }

    /* Initial generate/loading view */
    .generate-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;
    }

    .generating-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }

    .generating-indicator p {
        margin: 0;
        color: #6b7280;
        font-size: 1rem;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #e5e7eb;
        border-top-color: rgb(0, 83, 135);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* G-code display view */
    .gcode-section {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .gcode-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background-color: #f8f9fa;
        border-bottom: 1px solid #e5e7eb;
        flex-shrink: 0;
    }

    .gcode-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .gcode-stats {
        font-size: 0.875rem;
        color: #6b7280;
    }

    .gcode-actions {
        display: flex;
        gap: 0.5rem;
    }

    .action-button {
        padding: 0.5rem 1rem;
        background-color: white;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s;
    }

    .action-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
    }

    .download-button {
        background-color: rgb(0, 83, 135);
        color: white;
        border-color: rgb(0, 83, 135);
    }

    .download-button:hover {
        background-color: rgb(0, 83, 135);
        border-color: rgb(0, 83, 135);
    }

    .regenerate-button {
        background-color: rgb(0, 133, 84);
        color: white;
        border-color: rgb(0, 133, 84);
    }

    .regenerate-button:hover:not(:disabled) {
        background-color: rgb(0, 133, 84);
        border-color: rgb(0, 133, 84);
    }

    .regenerate-button:disabled {
        background-color: #e5e7eb;
        border-color: #e5e7eb;
        color: #9ca3af;
        cursor: not-allowed;
    }

    /* G-code content area */
    .gcode-content {
        flex: 1;
        display: flex;
        overflow: hidden;
    }

    .gcode-textarea {
        flex: 1;
        width: 100%;
        height: 100%;
        padding: 1rem;
        border: none;
        background-color: #1e1e1e;
        color: #d4d4d4;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 0.875rem;
        line-height: 1.5;
        resize: none;
        overflow: auto;
    }

    .gcode-textarea:focus {
        outline: none;
    }

    .error-message {
        text-align: center;
        color: rgb(133, 18, 0);
        font-size: 1rem;
    }

    .error-message p {
        margin: 0;
    }
</style>
