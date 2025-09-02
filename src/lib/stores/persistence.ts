/**
 * Application State Persistence
 * 
 * Coordinates saving and restoring state across all stores
 */

import { get } from 'svelte/store';
import { 
  saveState, 
  loadState, 
  clearPersistedState, 
  debouncedSave,
  type PersistedState 
} from '../utils/state-persistence';

// Import all stores
import { drawingStore, type DrawingState } from './drawing';
import { workflowStore, type WorkflowState, type WorkflowStage } from './workflow';
import { chainStore, type ChainStore } from './chains';
import { partStore, type PartStore } from './parts';
import { rapidStore, type RapidsState } from './rapids';
import { uiStore, type UIState } from './ui';
import { tessellationStore, type TessellationState } from './tessellation';
import { overlayStore, type OverlayState } from './overlay';
import { leadWarningsStore, type LeadWarning } from './lead-warnings';
import { prepareStageStore, type PrepareStageState } from './prepare-stage';
import { operationsStore, type Operation } from './operations';
import { pathStore, type PathsState } from './paths';
import { toolStore, type Tool } from './tools';
import type { WarningState } from './warning-store-base';

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
  const paths: PathsState = get(pathStore);
  const tools: Tool[] = get(toolStore);
  
  return {
    // Drawing state
    drawing: drawing.drawing,
    selectedShapes: Array.from(drawing.selectedShapes),
    hoveredShape: drawing.hoveredShape,
    scale: drawing.scale,
    offset: drawing.offset,
    fileName: drawing.fileName,
    layerVisibility: drawing.layerVisibility,
    displayUnit: drawing.displayUnit,
    
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
    
    // Operations, paths, and tools
    operations: operations,
    paths: paths.paths, // Just the paths array
    selectedPathId: paths.selectedPathId,
    highlightedPathId: paths.highlightedPathId,
    tools: tools,
    
    // Timestamp
    savedAt: new Date().toISOString()
  };
}

/**
 * Restore state to all stores using their proper APIs
 */
function restoreStateToStores(state: PersistedState): void {
  try {
    // Import store helper functions
    import('./chains').then(({ setChains, setTolerance, selectChain }) => {
      setChains(state.chains);
      setTolerance(state.tolerance);
      if (state.selectedChainId) {
        selectChain(state.selectedChainId);
      }
    });
    
    import('./parts').then(({ setParts, highlightPart }) => {
      setParts(state.parts, state.partWarnings);
      if (state.highlightedPartId) {
        highlightPart(state.highlightedPartId);
      }
    });
    
    // Restore drawing state - use special restoration method to avoid resetting downstream stages
    if (state.drawing) {
      // Use the new restoreDrawing method that doesn't reset downstream stages
      drawingStore.restoreDrawing(
        state.drawing,
        state.fileName,
        state.scale,
        state.offset,
        state.displayUnit,
        new Set(state.selectedShapes),
        state.hoveredShape
      );
      
      // Restore layer visibility separately
      Object.entries(state.layerVisibility).forEach(([layer, visible]) => {
        drawingStore.setLayerVisibility(layer, visible);
      });
    }
    
    // Restore workflow state using the dedicated restore method
    workflowStore.restore(state.currentStage as WorkflowStage, state.completedStages as WorkflowStage[]);
    
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
          overlayStore.setShapePoints(stage as WorkflowStage, overlayData.shapePoints);
        }
        if (overlayData.chainEndpoints?.length > 0) {
          overlayStore.setChainEndpoints(stage as WorkflowStage, overlayData.chainEndpoints);
        }
        if (overlayData.tessellationPoints?.length > 0) {
          overlayStore.setTessellationPoints(stage as WorkflowStage, overlayData.tessellationPoints);
        }
        if (overlayData.toolHead) {
          overlayStore.setToolHead(stage as WorkflowStage, overlayData.toolHead);
        }
      });
    }
    
    // Restore lead warnings
    leadWarningsStore.clearAllWarnings();
    state.leadWarnings.forEach(warning => {
      leadWarningsStore.addWarning(warning);
    });
    
    // Restore prepare stage state
    if (state.prepareStageState) {
      prepareStageStore.setAlgorithmParams(state.prepareStageState.algorithmParams);
      prepareStageStore.setChainNormalizationResults(state.prepareStageState.chainNormalizationResults);
      prepareStageStore.setColumnWidths(
        state.prepareStageState.leftColumnWidth,
        state.prepareStageState.rightColumnWidth
      );
    }
    
    // Restore operations and paths using reorder methods to avoid side effects
    if (state.operations && Array.isArray(state.operations)) {
      operationsStore.reorderOperations(state.operations);
    }
    
    if (state.paths && Array.isArray(state.paths)) {
      // Restore paths with their original IDs and lead geometry
      const pathsState: PathsState = {
        paths: state.paths,
        selectedPathId: state.selectedPathId || null,
        highlightedPathId: state.highlightedPathId || null
      };
      pathStore.restore(pathsState);
    }
    
    if (state.tools && Array.isArray(state.tools)) {
      toolStore.reorderTools(state.tools);
    }
    
    console.log('Application state restored successfully');
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
 * Setup auto-save subscriptions for all stores
 */
export function setupAutoSave(): () => void {
  // Subscribe to all stores and trigger auto-save on changes
  const unsubscribers: Array<() => void> = [];
  
  unsubscribers.push(drawingStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(workflowStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(chainStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(partStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(rapidStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(uiStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(tessellationStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(overlayStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(leadWarningsStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(prepareStageStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(operationsStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(pathStore.subscribe(() => autoSaveApplicationState()));
  unsubscribers.push(toolStore.subscribe(() => autoSaveApplicationState()));
  
  console.log('Auto-save subscriptions setup complete');
  
  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub());
    console.log('Auto-save subscriptions cleaned up');
  };
}