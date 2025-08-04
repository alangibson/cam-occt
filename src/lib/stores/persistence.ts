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
} from '../utils/state-persistence.js';

// Import all stores
import { drawingStore } from './drawing.js';
import { workflowStore } from './workflow.js';
import { chainStore } from './chains.js';
import { partStore } from './parts.js';
import { rapidStore } from './rapids.js';
import { uiStore } from './ui.js';
import { tessellationStore } from './tessellation.js';
import { overlayStore } from './overlay.js';
import { leadWarningsStore } from './lead-warnings.js';
import { prepareStageStore } from './prepare-stage.js';
import { operationsStore } from './operations.js';
import { pathStore } from './paths.js';
import { toolStore } from './tools.js';

/**
 * Collect current state from all stores
 */
function collectCurrentState(): PersistedState {
  const drawing = get(drawingStore);
  const workflow = get(workflowStore);
  const chains = get(chainStore);
  const parts = get(partStore);
  const rapids = get(rapidStore);
  const ui = get(uiStore);
  const tessellation = get(tessellationStore);
  const overlay = get(overlayStore);
  const leadWarnings = get(leadWarningsStore);
  const prepareStage = get(prepareStageStore);
  const operations = get(operationsStore);
  const paths = get(pathStore);
  const tools = get(toolStore);
  
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
    workflowStore.restore(state.currentStage as any, state.completedStages);
    
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
    overlayStore.setCurrentStage(state.overlayStage as any);
    
    // Restore the full overlays object with all stage-specific data
    if (state.overlays) {
      // We need to restore each stage's overlay data
      Object.entries(state.overlays).forEach(([stage, overlayData]: [string, any]) => {
        if (overlayData.shapePoints?.length > 0) {
          overlayStore.setShapePoints(stage as any, overlayData.shapePoints);
        }
        if (overlayData.chainEndpoints?.length > 0) {
          overlayStore.setChainEndpoints(stage as any, overlayData.chainEndpoints);
        }
        if (overlayData.tessellationPoints?.length > 0) {
          overlayStore.setTessellationPoints(stage as any, overlayData.tessellationPoints);
        }
        if (overlayData.toolHead) {
          overlayStore.setToolHead(stage as any, overlayData.toolHead);
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
      const pathsState = {
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
  const currentState = collectCurrentState();
  saveState(currentState);
}

/**
 * Save current application state with debouncing
 */
export function autoSaveApplicationState(): void {
  const currentState = collectCurrentState();
  debouncedSave(currentState);
}

/**
 * Restore application state from localStorage
 */
export function restoreApplicationState(): boolean {
  const savedState = loadState();
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