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
    import { chainStore } from '$lib/stores/chains/store.svelte';
    import {
        restoreApplicationState,
        setupAutoSave,
        saveApplicationState,
        clearApplicationState,
    } from '$lib/stores/storage/store';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { ImportUnitSetting } from '$lib/config/settings/enums';
    import { kerfStore } from '$lib/stores/kerfs/store.svelte';
    import { operationsStore } from '$lib/stores/operations/store.svelte';
    import { planStore } from '$lib/stores/plan/store.svelte';
    import { cutStore } from '$lib/stores/cuts/store.svelte';
    import { rapidStore } from '$lib/stores/rapids/store.svelte';
    import {
        toolStore,
        createDefaultTool,
    } from '$lib/stores/tools/store.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { autoSaveApplicationState } from '$lib/stores/storage/store';

    let cleanupAutoSave: (() => void) | null = null;
    let isMenuOpen = $state(false);

    // Auto-save when drawingStore changes (Svelte 5 reactive store)
    $effect(() => {
        // Access all reactive properties to track them
        void drawingStore.drawing;
        void drawingStore.scale;
        void drawingStore.offset;
        void drawingStore.displayUnit;
        void drawingStore.layerVisibility;

        // Trigger auto-save
        autoSaveApplicationState();
    });

    // Auto-save when chainStore changes (Svelte 5 reactive store)
    $effect(() => {
        // Access all reactive properties to track them
        void chainStore.tolerance;
        void chainStore.showChainPaths;
        void chainStore.showChainStartPoints;
        void chainStore.showChainEndPoints;
        void chainStore.showChainTangentLines;
        void chainStore.showChainNormals;
        void chainStore.showChainDirections;
        void chainStore.showChainTessellation;

        // Trigger auto-save
        autoSaveApplicationState();
    });

    // Auto-save when operationsStore changes (Svelte 5 reactive store)
    $effect(() => {
        // Access the operations array to track changes
        void operationsStore.operations;

        // Trigger auto-save
        autoSaveApplicationState();
    });

    // Auto-save when workflowStore changes (Svelte 5 reactive store)
    $effect(() => {
        // Access reactive properties to track them
        void workflowStore.currentStage;
        void workflowStore.completedStages;

        // Trigger auto-save
        autoSaveApplicationState();
    });

    // Auto-save when toolStore changes (Svelte 5 reactive store)
    $effect(() => {
        // Access reactive properties to track them
        void toolStore.tools;

        // Trigger auto-save
        autoSaveApplicationState();
    });

    // Auto-save when selectionStore changes (Svelte 5 reactive store)
    $effect(() => {
        // Access reactive properties to track them
        void selectionStore.shapes;
        void selectionStore.chains;
        void selectionStore.parts;
        void selectionStore.cuts;
        void selectionStore.rapids;
        void selectionStore.leads;
        void selectionStore.kerfs;

        // Trigger auto-save
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
        cutStore.reset(); // Clear cut UI state (selection, highlighting)
        rapidStore.reset(); // Clear rapid UI state (selection, highlighting)
        kerfStore.clearKerfs();

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
