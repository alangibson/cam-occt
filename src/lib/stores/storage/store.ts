/**
 * Application State Persistence
 *
 * Coordinates saving and restoring state across all stores
 */

import { clearPersistedState, loadState, saveState } from './local-storage';
import { MILLISECONDS_IN_SECOND } from './constants';
import { type PersistedState } from './interfaces';
import { Unit } from '$lib/config/units/units';

// Import all stores
import { drawingStore } from '$lib/stores/drawing/store.svelte';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import type { WorkflowState } from '$lib/stores/workflow/interfaces';
import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
import type { CutsState } from '$lib/stores/visualization/classes.svelte';
import { partStore } from '$lib/stores/parts/store.svelte';
import { uiStore } from '$lib/stores/ui/store.svelte';
import type { UIState } from '$lib/stores/ui/interfaces';
import { overlayStore } from '$lib/stores/overlay/store.svelte';
import type { OverlayState } from '$lib/stores/overlay/interfaces';
import { operationsStore } from '$lib/stores/operations/store.svelte';
import type { OperationData } from '$lib/cam/operation/interface';
import { Operation } from '$lib/cam/operation/classes.svelte';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { planStore } from '$lib/stores/plan/store.svelte';
import { toolStore, createDefaultTool } from '$lib/stores/tools/store.svelte';
import type { Tool } from '$lib/cam/tool/interfaces';
import { settingsStore } from '$lib/stores/settings/store.svelte';
import { selectionStore } from '$lib/stores/selection/store.svelte';
import type { SelectionState } from '$lib/stores/selection/interfaces';

/**
 * Collect current state from all stores
 */
function collectCurrentState(): PersistedState {
    const workflow: WorkflowState = {
        currentStage: workflowStore.currentStage,
        completedStages: workflowStore.completedStages,
        canAdvanceTo: workflowStore.canAdvanceTo.bind(workflowStore),
    };
    const ui: UIState = {
        showToolTable: uiStore.toolTableVisible,
        showSettings: uiStore.settingsVisible,
    };
    const overlay: OverlayState = {
        currentStage: overlayStore.currentStage,
        overlays: overlayStore.overlays,
    };
    const operations: OperationData[] = operationsStore.operations.map((op) =>
        op.toData()
    );
    const plan = planStore.plan;
    const cutsUIState: CutsState = {
        showCutNormals: visualizationStore.showCutNormals,
        showCutDirections: visualizationStore.showCutDirections,
        showCutPaths: visualizationStore.showCutPaths,
        showCutStartPoints: visualizationStore.showCutStartPoints,
        showCutEndPoints: visualizationStore.showCutEndPoints,
        showCutTangentLines: visualizationStore.showCutTangentLines,
    };
    const tools: Tool[] = toolStore.tools;
    const settings = settingsStore.settings;
    const rapidUIState = {
        showRapids: visualizationStore.showRapids,
        showRapidDirections: visualizationStore.showRapidDirections,
    };
    const selection: SelectionState = selectionStore.getState();

    // Collect chains from drawing layers
    const allChains =
        drawingStore.drawing && drawingStore.drawing.layers
            ? Object.values(drawingStore.drawing.layers).flatMap(
                  (layer) => layer.chains
              )
            : [];

    return {
        // Drawing state
        drawing: drawingStore.drawing ? drawingStore.drawing.toData() : null,
        scale: drawingStore.scale,
        offset: drawingStore.offset,
        fileName: drawingStore.drawing?.fileName ?? '',
        layerVisibility: drawingStore.layerVisibility,
        displayUnit: drawingStore.displayUnit as 'mm' | 'inch',

        // Workflow state
        currentStage: workflow.currentStage,
        completedStages: Array.from(workflow.completedStages),

        // Chains state
        chains: allChains,
        tolerance: visualizationStore.tolerance,

        // Parts state - get from drawing layers
        parts: drawingStore.drawing
            ? Object.values(drawingStore.drawing.layers).flatMap(
                  (layer) => layer.parts
              )
            : [],
        partWarnings: partStore.warnings,

        // Rapids UI state (rapids data is now in Cut.rapidIn)
        showRapids: rapidUIState.showRapids,

        // UI state
        showToolTable: ui.showToolTable,

        // Tessellation state
        tessellationActive: visualizationStore.tessellationActive,
        tessellationPoints: visualizationStore.tessellationPoints,

        // Overlay state
        overlayStage: overlay.currentStage,
        overlays: overlay.overlays,

        // Operations, cuts, and tools
        operations: operations,
        cuts: plan?.cuts?.map((cut) => cut.toData()) ?? [], // Cuts from Plan (convert Cut[] to CutData[])
        tools: tools,

        // Application settings
        applicationSettings: settings,

        // Cut visualization state
        showCutNormals: cutsUIState.showCutNormals,
        showCutDirections: cutsUIState.showCutDirections,
        showCutPaths: cutsUIState.showCutPaths,
        showCutStartPoints: cutsUIState.showCutStartPoints,
        showCutEndPoints: cutsUIState.showCutEndPoints,
        showCutTangentLines: cutsUIState.showCutTangentLines,

        // Unified selection state
        selection: {
            shapes: {
                selected: Array.from(selection.shapes.selected),
                hovered: selection.shapes.hovered,
                selectedOffset: selection.shapes.selectedOffset,
            },
            chains: {
                selected: Array.from(selection.chains.selected),
                highlighted: selection.chains.highlighted,
            },
            parts: {
                selected: Array.from(selection.parts.selected),
                highlighted: selection.parts.highlighted,
                hovered: selection.parts.hovered,
            },
            cuts: {
                selected: Array.from(selection.cuts.selected),
                highlighted: selection.cuts.highlighted,
            },
            rapids: {
                selected: Array.from(selection.rapids.selected),
                highlighted: selection.rapids.highlighted,
            },
            leads: {
                selected: Array.from(selection.leads.selected),
                highlighted: selection.leads.highlighted,
            },
            kerfs: {
                selected: selection.kerfs.selected,
                highlighted: selection.kerfs.highlighted,
            },
        },

        // Timestamp
        savedAt: new Date().toISOString(),
    };
}

/**
 * Restore state to all stores using their proper APIs
 */
function restoreStateToStores(state: PersistedState): void {
    try {
        // Set chain store state
        // Chains are auto-generated from drawing layers, no need to set them
        visualizationStore.setTolerance(state.tolerance);

        // Set part store state (warnings only - parts now come from Drawing.layers)
        partStore.setWarnings(state.partWarnings);

        // Restore drawing state - use special restoration method to avoid resetting downstream stages
        if (state.drawing) {
            // Use the new restoreDrawing method that doesn't reset downstream stages
            drawingStore.restoreDrawing(
                new Drawing(state.drawing),
                state.fileName ?? '',
                state.scale,
                state.offset,
                state.displayUnit === 'mm' ? Unit.MM : Unit.INCH
            );

            // Restore layer visibility separately
            Object.entries(state.layerVisibility).forEach(
                ([layer, visible]) => {
                    drawingStore.setLayerVisibility(layer, visible);
                }
            );
        }

        // Restore workflow state using the dedicated restore method
        workflowStore.restore(
            state.currentStage as WorkflowStage,
            state.completedStages as WorkflowStage[]
        );

        // Restore rapids UI state (rapids data is now in Cut.rapidIn)
        visualizationStore.setShowRapids(state.showRapids);

        // Restore unified selection state
        if (state.selection) {
            // Restore shapes selection
            if (state.selection.shapes.selected.length > 0) {
                state.selection.shapes.selected.forEach((shapeId, index) => {
                    selectionStore.selectShape(shapeId, index > 0);
                });
            }
            if (state.selection.shapes.hovered) {
                selectionStore.setHoveredShape(state.selection.shapes.hovered);
            }
            if (state.selection.shapes.selectedOffset) {
                selectionStore.selectOffsetShape(
                    state.selection.shapes.selectedOffset
                );
            }

            // Restore chains selection
            if (state.selection.chains.selected.length > 0) {
                state.selection.chains.selected.forEach((chainId, index) => {
                    selectionStore.selectChain(chainId, index > 0);
                });
            }
            if (state.selection.chains.highlighted) {
                selectionStore.highlightChain(
                    state.selection.chains.highlighted
                );
            }

            // Restore parts selection
            if (state.selection.parts.selected.length > 0) {
                state.selection.parts.selected.forEach((partId, index) => {
                    selectionStore.selectPart(partId, index > 0);
                });
            }
            if (state.selection.parts.highlighted) {
                selectionStore.highlightPart(state.selection.parts.highlighted);
            }
            if (state.selection.parts.hovered) {
                selectionStore.hoverPart(state.selection.parts.hovered);
            }

            // Restore cuts selection
            if (state.selection.cuts.selected.length > 0) {
                state.selection.cuts.selected.forEach((cutId, index) => {
                    selectionStore.selectCut(cutId, index > 0);
                });
            }
            if (state.selection.cuts.highlighted) {
                selectionStore.highlightCut(state.selection.cuts.highlighted);
            }

            // Restore rapids selection
            if (state.selection.rapids.selected.length > 0) {
                selectionStore.selectRapids(
                    new Set(state.selection.rapids.selected)
                );
            }
            if (state.selection.rapids.highlighted) {
                selectionStore.highlightRapid(
                    state.selection.rapids.highlighted
                );
            }

            // Restore leads selection
            if (state.selection.leads.selected.length > 0) {
                state.selection.leads.selected.forEach((leadId, index) => {
                    selectionStore.selectLead(leadId, index > 0);
                });
            }
            if (state.selection.leads.highlighted) {
                selectionStore.highlightLead(state.selection.leads.highlighted);
            }

            // Restore kerfs selection
            if (state.selection.kerfs.selected) {
                selectionStore.selectKerf(state.selection.kerfs.selected);
            }
            if (state.selection.kerfs.highlighted) {
                selectionStore.highlightKerf(state.selection.kerfs.highlighted);
            }
        }

        // Restore UI state
        if (state.showToolTable) {
            uiStore.showToolTable();
        } else {
            uiStore.hideToolTable();
        }

        // Restore tessellation state
        if (state.tessellationActive && state.tessellationPoints.length > 0) {
            visualizationStore.setTessellation(state.tessellationPoints);
        } else {
            visualizationStore.clearTessellation();
        }

        // Restore overlay state
        overlayStore.setCurrentStage(state.overlayStage as WorkflowStage);

        // Restore the full overlays object with all stage-specific data
        if (state.overlays) {
            // We need to restore each stage's overlay data
            Object.entries(state.overlays).forEach(([stage, overlayData]) => {
                if (overlayData.shapePoints?.length > 0) {
                    overlayStore.setShapePoints(
                        stage as WorkflowStage,
                        overlayData.shapePoints
                    );
                }
                if (overlayData.chainEndpoints?.length > 0) {
                    overlayStore.setChainEndpoints(
                        stage as WorkflowStage,
                        overlayData.chainEndpoints
                    );
                }
                if (overlayData.tessellationPoints?.length > 0) {
                    overlayStore.setTessellationPoints(
                        stage as WorkflowStage,
                        overlayData.tessellationPoints
                    );
                }
                if (overlayData.toolHead) {
                    overlayStore.setToolHead(
                        stage as WorkflowStage,
                        overlayData.toolHead
                    );
                }
            });
        }

        // Restore operations and cuts using reorder methods to avoid side effects
        if (state.operations && Array.isArray(state.operations)) {
            operationsStore.reorderOperations(
                state.operations.map(
                    (opData) =>
                        new Operation({
                            ...opData,
                            // Migration: add default action if not present
                            action: opData.action || 'cut',
                        })
                )
            );
        }

        if (state.cuts && Array.isArray(state.cuts)) {
            // Restore cuts to Plan (convert CutData[] to Cut[])
            const plan = planStore.plan;
            plan.cuts = state.cuts.map((cutData) => {
                // Validate that cut has required fields
                if (!cutData.id) {
                    // Cut missing required id field - cannot restore cut without id
                    throw new Error('Cut data missing required id field');
                }
                return new Cut(cutData);
            });

            // Restore cuts visualization state to visualizationStore (selection is in selectionStore)
            const cutsUIState: CutsState = {
                showCutNormals: state.showCutNormals || false,
                showCutDirections: state.showCutDirections || false,
                showCutPaths:
                    state.showCutPaths !== undefined
                        ? state.showCutPaths
                        : true,
                showCutStartPoints: state.showCutStartPoints || false,
                showCutEndPoints: state.showCutEndPoints || false,
                showCutTangentLines: state.showCutTangentLines || false,
            };
            visualizationStore.restoreCuts(cutsUIState);
        }

        if (state.tools && Array.isArray(state.tools)) {
            toolStore.reorderTools(state.tools);
        }
    } catch {
        // Failed to restore application state - state restoration threw exception
    }
}

/**
 * Save current application state
 */
export function saveApplicationState(): void {
    const currentState: PersistedState = collectCurrentState();
    saveState(currentState);
}

/**
 * Debounced auto-save function that defers expensive serialization
 * This ensures collectCurrentState() only runs once after the debounce delay
 */
const debouncedAutoSave = (() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            const currentState: PersistedState = collectCurrentState();
            saveState(currentState);
        }, MILLISECONDS_IN_SECOND); // 1 second delay
    };
})();

/**
 * Save current application state with debouncing
 * Debounces both the expensive collectCurrentState() serialization AND the localStorage write
 */
export function autoSaveApplicationState(): void {
    debouncedAutoSave();
}

/**
 * Restore application state from localStorage
 */
export function restoreApplicationState(): boolean {
    const savedState: PersistedState | null = loadState();
    if (savedState) {
        restoreStateToStores(savedState);
        return true;
    }
    return false;
}

/**
 * Clear all persisted application state
 */
export function clearApplicationState(): void {
    clearPersistedState();
}

/**
 * Reset all stores to their default state and clear localStorage
 */
export function resetApplicationToDefaults(): void {
    // Clear localStorage first
    clearPersistedState();

    // Reset all stores to their default states
    drawingStore.reset();
    workflowStore.reset();
    // Chains auto-clear when drawing is reset
    partStore.clearParts();
    visualizationStore.reset();
    uiStore.hideToolTable();
    overlayStore.clearAllOverlays();
    operationsStore.reset();
    toolStore.reset();
    settingsStore.resetToDefaults();
    selectionStore.reset();

    // Create default tool after clearing
    toolStore.addTool(createDefaultTool(1));
}

/**
 * Setup auto-save subscriptions for all stores
 * Note: drawingStore, chainStore, partStore, operationsStore, cutStore, tessellationStore, overlayStore,
 * toolStore, selectionStore, workflowStore, rapidStore, and uiStore use Svelte 5 runes and should be watched with $effect in the component
 */
export function setupAutoSave(): () => void {
    // Subscribe to all stores and trigger auto-save on changes
    const unsubscribers: Array<() => void> = [];

    // NOTE: All stores are now Svelte 5 runes-based stores.
    // They should be watched with $effect in the component that calls setupAutoSave.

    // Return cleanup function
    return () => {
        unsubscribers.forEach((unsub) => unsub());
    };
}
