/**
 * Application State Persistence
 *
 * Coordinates saving and restoring state across all stores
 */

import { get } from 'svelte/store';
import {
    clearPersistedState,
    debouncedSave,
    loadState,
    saveState,
} from './local-storage';
import { type PersistedState } from './interfaces';
import { Unit } from '$lib/utils/units';

// Import all stores
import { drawingStore } from '$lib/stores/drawing/store';
import type { DrawingState } from '$lib/stores/drawing/interfaces';
import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import type { WorkflowState } from '$lib/stores/workflow/interfaces';
import { chainStore } from '$lib/stores/chains/store';
import type { ChainStore } from '$lib/stores/chains/interfaces';
import { partStore } from '$lib/stores/parts/store';
import type { PartStore } from '$lib/stores/parts/interfaces';
import { rapidStore } from '$lib/stores/rapids/store';
import type { RapidsState } from '$lib/stores/rapids/interfaces';
import { uiStore } from '$lib/stores/ui/store';
import type { UIState } from '$lib/stores/ui/interfaces';
import { tessellationStore } from '$lib/stores/tessellation/store';
import type { TessellationState } from '$lib/stores/tessellation/interfaces';
import { overlayStore } from '$lib/stores/overlay/store';
import type { OverlayState } from '$lib/stores/overlay/interfaces';
import { leadWarningsStore } from '$lib/stores/lead-warnings/store';
import type { LeadWarning } from '$lib/stores/lead-warnings/interfaces';
import { prepareStageStore } from '$lib/stores/prepare-stage/store';
import type { PrepareStageState } from '$lib/stores/prepare-stage/interfaces';
import { DEFAULT_ALGORITHM_PARAMETERS_MM } from '$lib/types/algorithm-parameters';
import { operationsStore } from '$lib/stores/operations/store';
import type { Operation } from '$lib/stores/operations/interfaces';
import { cutStore } from '$lib/stores/cuts/store';
import type { CutsState } from '$lib/stores/cuts/interfaces';
import { toolStore } from '$lib/stores/tools/store';
import type { Tool } from '$lib/stores/tools/interfaces';
import type { WarningState } from '$lib/stores/warnings/interfaces';
import { settingsStore } from '$lib/stores/settings/store';
import type { SettingsState } from '$lib/stores/settings/interfaces';

/**
 * Collect current state from all stores
 */
function collectCurrentState(): PersistedState {
    const drawing: DrawingState = get(drawingStore);
    const workflow: WorkflowState = get(workflowStore);
    const chains: ChainStore = get(chainStore);
    const parts: PartStore = get(partStore);
    const rapids: RapidsState = get(rapidStore);
    const ui: UIState = get(uiStore);
    const tessellation: TessellationState = get(tessellationStore);
    const overlay: OverlayState = get(overlayStore);
    const leadWarnings: WarningState<LeadWarning> = get(leadWarningsStore);
    const prepareStage: PrepareStageState = get(prepareStageStore);
    const operations: Operation[] = get(operationsStore);
    const cuts: CutsState = get(cutStore);
    const tools: Tool[] = get(toolStore);
    const settings: SettingsState = get(settingsStore);

    return {
        // Drawing state
        drawing: drawing.drawing,
        selectedShapes: Array.from(drawing.selectedShapes),
        hoveredShape: drawing.hoveredShape,
        scale: drawing.scale,
        offset: drawing.offset,
        fileName: drawing.fileName,
        layerVisibility: drawing.layerVisibility,
        displayUnit: drawing.displayUnit as 'mm' | 'inch',

        // Workflow state
        currentStage: workflow.currentStage,
        completedStages: Array.from(workflow.completedStages),

        // Chains state
        chains: chains.chains,
        tolerance: chains.tolerance,
        selectedChainId: chains.selectedChainId,

        // Parts state
        parts: parts.parts,
        partWarnings: parts.warnings,
        highlightedPartId: parts.highlightedPartId,

        // Rapids state
        rapids: rapids.rapids,
        showRapids: rapids.showRapids,
        selectedRapidId: rapids.selectedRapidId,
        highlightedRapidId: rapids.highlightedRapidId,

        // UI state
        showToolTable: ui.showToolTable,

        // Tessellation state
        tessellationActive: tessellation.isActive,
        tessellationPoints: tessellation.points,

        // Overlay state
        overlayStage: overlay.currentStage,
        overlays: overlay.overlays,

        // Lead warnings
        leadWarnings: leadWarnings.warnings,

        // Prepare stage state
        prepareStageState: prepareStage,

        // Operations, cuts, and tools
        operations: operations,
        cuts: cuts.cuts, // Just the cuts array
        selectedCutId: cuts.selectedCutId, // Cut selection state
        highlightedCutId: cuts.highlightedCutId, // Cut highlight state
        showCutNormals: cuts.showCutNormals, // Cut normals visibility state
        showCutter: cuts.showCutter, // Cutter visualization visibility state
        showCutDirections: cuts.showCutDirections, // Cut directions visibility state
        showCutPaths: cuts.showCutPaths, // Cut paths visibility state
        showCutStartPoints: cuts.showCutStartPoints, // Cut start points visibility state
        showCutEndPoints: cuts.showCutEndPoints, // Cut end points visibility state
        tools: tools,

        // Application settings
        applicationSettings: settings.settings,

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
        chainStore.setChains(state.chains);
        chainStore.setTolerance(state.tolerance);
        if (state.selectedChainId) {
            chainStore.selectChain(state.selectedChainId);
        }

        // Set part store state
        partStore.setParts(state.parts, state.partWarnings);
        if (state.highlightedPartId) {
            partStore.highlightPart(state.highlightedPartId);
        }

        // Restore drawing state - use special restoration method to avoid resetting downstream stages
        if (state.drawing) {
            // Use the new restoreDrawing method that doesn't reset downstream stages
            drawingStore.restoreDrawing(
                state.drawing,
                state.fileName,
                state.scale,
                state.offset,
                state.displayUnit === 'mm' ? Unit.MM : Unit.INCH,
                new Set(state.selectedShapes),
                state.hoveredShape
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

        // Restore rapids state
        rapidStore.setRapids(state.rapids);
        rapidStore.setShowRapids(state.showRapids);
        if (state.selectedRapidId) {
            rapidStore.selectRapid(state.selectedRapidId);
        }
        if (state.highlightedRapidId) {
            rapidStore.highlightRapid(state.highlightedRapidId);
        }

        // Restore UI state
        if (state.showToolTable) {
            uiStore.showToolTable();
        } else {
            uiStore.hideToolTable();
        }

        // Restore tessellation state
        if (state.tessellationActive && state.tessellationPoints.length > 0) {
            tessellationStore.setTessellation(state.tessellationPoints);
        } else {
            tessellationStore.clearTessellation();
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

        // Restore lead warnings
        leadWarningsStore.clearAllWarnings();
        state.leadWarnings.forEach((warning) => {
            leadWarningsStore.addWarning(warning);
        });

        // Restore prepare stage state
        if (state.prepareStageState) {
            // Merge with defaults to ensure all properties exist
            const mergedAlgorithmParams = {
                ...DEFAULT_ALGORITHM_PARAMETERS_MM,
                ...state.prepareStageState.algorithmParams,
                // Ensure nested objects are also merged properly
                chainDetection: {
                    ...DEFAULT_ALGORITHM_PARAMETERS_MM.chainDetection,
                    ...(state.prepareStageState.algorithmParams
                        ?.chainDetection || {}),
                },
                chainNormalization: {
                    ...DEFAULT_ALGORITHM_PARAMETERS_MM.chainNormalization,
                    ...(state.prepareStageState.algorithmParams
                        ?.chainNormalization || {}),
                },
                partDetection: {
                    ...DEFAULT_ALGORITHM_PARAMETERS_MM.partDetection,
                    ...(state.prepareStageState.algorithmParams
                        ?.partDetection || {}),
                },
                joinColinearLines: {
                    ...DEFAULT_ALGORITHM_PARAMETERS_MM.joinColinearLines,
                    ...(state.prepareStageState.algorithmParams
                        ?.joinColinearLines || {}),
                },
            };

            prepareStageStore.setAlgorithmParams(mergedAlgorithmParams);
            prepareStageStore.setChainNormalizationResults(
                state.prepareStageState.chainNormalizationResults
            );
            prepareStageStore.setColumnWidths(
                state.prepareStageState.leftColumnWidth,
                state.prepareStageState.rightColumnWidth
            );
        }

        // Restore operations and cuts using reorder methods to avoid side effects
        if (state.operations && Array.isArray(state.operations)) {
            operationsStore.reorderOperations(state.operations);
        }

        if (state.cuts && Array.isArray(state.cuts)) {
            // Restore cuts with their original IDs and lead geometry
            const cutsState: CutsState = {
                cuts: state.cuts,
                selectedCutId: state.selectedCutId || null,
                highlightedCutId: state.highlightedCutId || null,
                showCutNormals: state.showCutNormals || false,
                showCutter: state.showCutter || false,
                showCutDirections: state.showCutDirections || false,
                showCutPaths: state.showCutPaths || false,
                showCutStartPoints: state.showCutStartPoints || false,
                showCutEndPoints: state.showCutEndPoints || false,
            };
            cutStore.restore(cutsState);
        }

        if (state.tools && Array.isArray(state.tools)) {
            toolStore.reorderTools(state.tools);
        }
    } catch (error) {
        console.error('Failed to restore application state:', error);
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
 * Save current application state with debouncing
 */
export function autoSaveApplicationState(): void {
    const currentState: PersistedState = collectCurrentState();
    debouncedSave(currentState);
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
    chainStore.clearChains();
    partStore.clearParts();
    rapidStore.reset();
    uiStore.hideToolTable();
    tessellationStore.clearTessellation();
    overlayStore.clearAllOverlays();
    leadWarningsStore.clearAllWarnings();
    prepareStageStore.reset();
    operationsStore.reset();
    cutStore.reset();
    toolStore.reset();
    settingsStore.resetToDefaults();
}

/**
 * Setup auto-save subscriptions for all stores
 */
export function setupAutoSave(): () => void {
    // Subscribe to all stores and trigger auto-save on changes
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
        drawingStore.subscribe(() => autoSaveApplicationState())
    );
    unsubscribers.push(
        workflowStore.subscribe(() => autoSaveApplicationState())
    );
    unsubscribers.push(chainStore.subscribe(() => autoSaveApplicationState()));
    unsubscribers.push(partStore.subscribe(() => autoSaveApplicationState()));
    unsubscribers.push(rapidStore.subscribe(() => autoSaveApplicationState()));
    unsubscribers.push(uiStore.subscribe(() => autoSaveApplicationState()));
    unsubscribers.push(
        tessellationStore.subscribe(() => autoSaveApplicationState())
    );
    unsubscribers.push(
        overlayStore.subscribe(() => autoSaveApplicationState())
    );
    unsubscribers.push(
        leadWarningsStore.subscribe(() => autoSaveApplicationState())
    );
    unsubscribers.push(
        prepareStageStore.subscribe(() => autoSaveApplicationState())
    );
    unsubscribers.push(
        operationsStore.subscribe(() => autoSaveApplicationState())
    );
    unsubscribers.push(cutStore.subscribe(() => autoSaveApplicationState()));
    unsubscribers.push(toolStore.subscribe(() => autoSaveApplicationState()));

    // Return cleanup function
    return () => {
        unsubscribers.forEach((unsub) => unsub());
        console.log('Auto-save subscriptions cleaned up');
    };
}
