<script lang="ts">
    import { onMount } from 'svelte';
    import WorkflowBreadcrumbs from '$components/layout/WorkflowBreadcrumbs.svelte';
    import WorkflowContainer from '$components/layout/WorkflowContainer.svelte';
    import Footer from '$components/layout/Footer.svelte';
    import ToolTable from '$components/pages/tool-table/ToolTable.svelte';
    import Settings from '$components/pages/settings/Settings.svelte';
    import { workflowStore } from '$lib/stores/workflow/store.svelte';
    import { uiStore } from '$lib/stores/ui/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { partStore } from '$lib/stores/parts/store.svelte';
    import { overlayStore } from '$lib/stores/overlay/store.svelte';
    import {
        restoreApplicationState,
        setupAutoSave,
        saveApplicationState,
        clearApplicationState,
    } from '$lib/stores/storage/store';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { ImportUnitSetting } from '$lib/config/settings/enums';
    import { operationsStore } from '$lib/stores/operations/store.svelte';
    import { planStore } from '$lib/stores/plan/store.svelte';
    import {
        toolStore,
        createDefaultTool,
    } from '$lib/stores/tools/store.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { autoSaveApplicationState } from '$lib/stores/storage/store';

    let cleanupAutoSave: (() => void) | null = null;
    let isMenuOpen = $state(false);

    // Consolidated auto-save effect - tracks ALL stores in one place
    // This ensures collectCurrentState() only runs once (after 1s debounce) instead of 6 times
    $effect(() => {
        // Drawing store
        void drawingStore.drawing;
        void drawingStore.scale;
        void drawingStore.offset;
        void drawingStore.displayUnit;
        void drawingStore.layerVisibility;

        // Visualization store (chains, cuts, leads, rapids, kerfs, shapes, tessellation)
        void visualizationStore.tolerance;
        void visualizationStore.showChainPaths;
        void visualizationStore.showChainStartPoints;
        void visualizationStore.showChainEndPoints;
        void visualizationStore.showChainTangentLines;
        void visualizationStore.showChainNormals;
        void visualizationStore.showChainDirections;
        void visualizationStore.showChainTessellation;

        // Operations store
        void operationsStore.operations;

        // Workflow store
        void workflowStore.currentStage;
        void workflowStore.completedStages;

        // Tool store
        void toolStore.tools;

        // Selection store
        void selectionStore.shapes;
        void selectionStore.chains;
        void selectionStore.parts;
        void selectionStore.cuts;
        void selectionStore.rapids;
        void selectionStore.leads;
        void selectionStore.kerfs;

        // Additional stores used by collectCurrentState (previously missing)
        void partStore.warnings;
        void visualizationStore.showRapids;
        void visualizationStore.showRapidDirections;
        void uiStore.toolTableVisible;
        void uiStore.settingsVisible;
        void visualizationStore.tessellationActive;
        void visualizationStore.tessellationPoints;
        void overlayStore.currentStage;
        void overlayStore.overlays;
        void visualizationStore.showCutNormals;
        void visualizationStore.showCutDirections;
        void visualizationStore.showCutPaths;
        void visualizationStore.showCutStartPoints;
        void visualizationStore.showCutEndPoints;
        void visualizationStore.showCutTangentLines;
        void planStore.plan;
        void settingsStore.settings;

        // Trigger debounced auto-save (will only run once after 1s of no changes)
        autoSaveApplicationState();
    });

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    function closeMenu() {
        isMenuOpen = false;
    }

    function clearDrawingState() {
        closeMenu();

        // Reset File Measurement Units to default (Automatic)
        settingsStore.setImportUnitSetting(ImportUnitSetting.Automatic);

        // Reset drawing store to empty state
        drawingStore.reset();

        // Clear downstream stores (chains are auto-generated from drawing layers)
        operationsStore.reset(); // Clear operations
        planStore.reset(); // Clear cuts (which contain rapids as cut.rapidIn)
        visualizationStore.reset(); // Clear visualization UI state

        // Reset workflow to import stage
        workflowStore.reset();

        // Clear persisted state from localStorage
        clearApplicationState();
    }

    onMount(() => {
        // Migrate any legacy localStorage data

        // Restore state from localStorage on app load
        const restored = restoreApplicationState();
        if (restored) {
            console.log('Application state restored from previous session');
        }

        // Ensure at least one tool exists (required for operations)
        const tools = toolStore.tools;
        if (tools.length === 0) {
            toolStore.addTool(createDefaultTool(1));
            console.log('Created default tool - no tools found in storage');
        }

        // Setup auto-save for all state changes
        cleanupAutoSave = setupAutoSave();

        // Save state when page is about to unload
        const handleBeforeUnload = () => {
            saveApplicationState();
        };

        // Close menu when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isMenuOpen &&
                !(event.target as Element)?.closest('.hamburger-container')
            ) {
                closeMenu();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('click', handleClickOutside);

        // Cleanup function
        return () => {
            if (cleanupAutoSave) {
                cleanupAutoSave();
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('click', handleClickOutside);
        };
    });
</script>

<div class="app">
    <!-- Header -->
    <header class="app-header">
        <!-- Hamburger Menu -->
        <div class="hamburger-container">
            <button
                class="hamburger-button"
                onclick={toggleMenu}
                aria-label="Menu"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M3 5h14M3 10h14M3 15h14"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                </svg>
            </button>

            {#if isMenuOpen}
                <div class="menu-dropdown">
                    <button
                        class="menu-item clear-menu-item"
                        onclick={() => clearDrawingState()}
                    >
                        Clear
                    </button>
                    <button
                        class="menu-item tools-menu-item"
                        onclick={() => {
                            closeMenu();
                            uiStore.toolTableVisible
                                ? uiStore.hideToolTable()
                                : uiStore.showToolTable();
                        }}
                    >
                        Tools
                    </button>
                    <button
                        class="menu-item settings-menu-item"
                        onclick={() => {
                            closeMenu();
                            uiStore.settingsVisible
                                ? uiStore.hideSettings()
                                : uiStore.showSettings();
                        }}
                    >
                        Settings
                    </button>
                </div>
            {/if}
        </div>

        <WorkflowBreadcrumbs />
    </header>

    <!-- Body -->
    <main class="app-body">
        {#if uiStore.settingsVisible}
            <Settings />
        {:else if uiStore.toolTableVisible}
            <ToolTable />
        {:else}
            <WorkflowContainer />
        {/if}
    </main>

    <!-- Footer -->
    <footer class="app-footer">
        <Footer />
    </footer>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        font-family:
            -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
    }

    .app-header {
        flex-shrink: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 0.5rem;
        background: #f8f9fa;
        border-bottom: 1px solid #e5e7eb;
        position: relative;
    }

    .hamburger-container {
        position: absolute;
        left: 0.5rem;
    }

    .hamburger-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        background: none;
        border: none;
        border-radius: 0.375rem;
        color: #4b5563;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .hamburger-button:hover {
        background: #f3f4f6;
    }

    .menu-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 0.25rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
        min-width: 120px;
        z-index: 1000;
        padding: 0.75rem 1rem;
    }

    .menu-item {
        display: block;
        width: 100%;
        padding: 0.5rem 0.5rem;
        background: none;
        border: none;
        text-align: left;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        border-radius: 0.25rem;
        margin: 0.25rem 0;
    }

    .clear-menu-item {
        color: rgb(133, 18, 0);
    }

    .clear-menu-item:hover {
        background: #fef2f2;
        color: rgb(133, 18, 0);
    }

    .tools-menu-item {
        color: rgb(0, 83, 135);
    }

    .tools-menu-item:hover {
        background: #e6f2ff;
        color: rgb(0, 83, 135);
    }

    .settings-menu-item {
        color: rgb(0, 83, 135);
    }

    .settings-menu-item:hover {
        background: #e6f2ff;
        color: rgb(0, 83, 135);
    }

    .app-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .app-footer {
        flex-shrink: 0;
    }
</style>
