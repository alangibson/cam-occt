import { writable } from 'svelte/store';
import type { Drawing, Shape, Point2D } from '../../lib/types';
import { clearChains } from './chains';
import { clearParts } from './parts';
import { moveShape, rotateShape, scaleShape } from '$lib/geometry';

// Import workflow store for state management
interface WorkflowStore {
  invalidateDownstreamStages: (fromStage: 'edit' | 'prepare') => void;
}

let workflowStore: WorkflowStore | null = null;
const getWorkflowStore = async (): Promise<WorkflowStore> => {
  if (!workflowStore) {
    const { workflowStore: ws } = await import('./workflow');
    workflowStore = ws as WorkflowStore;
  }
  return workflowStore;
};

// Helper function to reset downstream stages when drawing is modified
const resetDownstreamStages = async (fromStage: 'edit' | 'prepare' = 'edit'): Promise<void> => {
  // Clear stage-specific data
  clearChains();
  clearParts();
  
  // Import and clear other stores
  const { overlayStore } = await import('./overlay');
  const { tessellationStore } = await import('./tessellation');
  const { pathStore } = await import('./paths');
  const { operationsStore } = await import('./operations');
  const { rapidStore } = await import('./rapids');
  
  overlayStore.clearStageOverlay('prepare');
  overlayStore.clearStageOverlay('program');
  overlayStore.clearStageOverlay('simulate');
  overlayStore.clearStageOverlay('export');
  tessellationStore.clearTessellation();
  
  // Clear program-specific stores
  pathStore.reset();
  operationsStore.reset();
  rapidStore.reset();
  
  // Reset workflow completion status for downstream stages
  const ws = await getWorkflowStore();
  ws.invalidateDownstreamStages(fromStage);
};

export interface DrawingState {
  drawing: Drawing | null;
  selectedShapes: Set<string>;
  hoveredShape: string | null;
  isDragging: boolean;
  dragStart: Point2D | null;
  scale: number;
  offset: Point2D;
  fileName: string | null;
  layerVisibility: { [layerName: string]: boolean };
  displayUnit: 'mm' | 'inch';
}

function createDrawingStore(): {
  subscribe: (run: (value: DrawingState) => void) => () => void;
  setDrawing: (drawing: Drawing, fileName?: string) => void;
  selectShape: (shapeId: string, multi?: boolean) => void;
  deselectShape: (shapeId: string) => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  moveShapes: (shapeIds: string[], delta: Point2D) => void;
  scaleShapes: (shapeIds: string[], scaleFactor: number, origin: Point2D) => void;
  rotateShapes: (shapeIds: string[], angle: number, origin: Point2D) => void;
  setViewTransform: (scale: number, offset: Point2D) => void;
  setLayerVisibility: (layerName: string, visible: boolean) => void;
  setHoveredShape: (shapeId: string | null) => void;
  setDisplayUnit: (unit: 'mm' | 'inch') => void;
  replaceAllShapes: (shapes: Shape[]) => void;
  restoreDrawing: (drawing: Drawing, fileName: string | null, scale: number, offset: Point2D, displayUnit: 'mm' | 'inch', selectedShapes: Set<string>, hoveredShape: string | null) => void;
} {
  const { subscribe, update } = writable<DrawingState>({
    drawing: null,
    selectedShapes: new Set(),
    hoveredShape: null,
    isDragging: false,
    dragStart: null,
    scale: 1,
    offset: { x: 0, y: 0 },
    fileName: null,
    layerVisibility: {},
    displayUnit: 'mm'
  });

  return {
    subscribe,
    setDrawing: (drawing: Drawing, fileName?: string) => {
      // Reset all application state when importing a new file
      resetDownstreamStages('edit');
      
      return update(state => ({ 
        ...state, 
        drawing,
        fileName: fileName || null,
        displayUnit: drawing.units, // Set display unit from drawing's detected units
        scale: 1, // Always start at 100% zoom
        offset: { x: 0, y: 0 }, // Reset offset
        selectedShapes: new Set(), // Clear selection
        hoveredShape: null, // Clear hover state
        isDragging: false, // Reset drag state
        dragStart: null // Reset drag start
      }));
    },
    
    selectShape: (shapeId: string, multi = false) => update(state => {
      const selectedShapes: Set<string> = new Set(multi ? state.selectedShapes : []);
      selectedShapes.add(shapeId);
      return { ...state, selectedShapes };
    }),
    
    deselectShape: (shapeId: string) => update(state => {
      const selectedShapes: Set<string> = new Set(state.selectedShapes);
      selectedShapes.delete(shapeId);
      return { ...state, selectedShapes };
    }),
    
    clearSelection: () => update(state => ({
      ...state,
      selectedShapes: new Set()
    })),
    
    deleteSelected: () => update(state => {
      if (!state.drawing) return state;
      
      const shapes: Shape[] = state.drawing.shapes.filter(
        shape => !state.selectedShapes.has(shape.id)
      );
      
      // Reset downstream stages when shapes are deleted
      resetDownstreamStages('edit');
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes },
        selectedShapes: new Set()
      };
    }),
    
    moveShapes: (shapeIds: string[], delta: Point2D) => update(state => {
      if (!state.drawing) return state;
      
      const shapes: Shape[] = state.drawing.shapes.map(shape => {
        if (shapeIds.includes(shape.id)) {
          return moveShape(shape, delta);
        }
        return shape;
      });
      
      // Reset downstream stages when shapes are moved
      resetDownstreamStages('edit');
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes }
      };
    }),
    
    scaleShapes: (shapeIds: string[], scaleFactor: number, origin: Point2D) => update(state => {
      if (!state.drawing) return state;
      
      const shapes: Shape[] = state.drawing.shapes.map(shape => {
        if (shapeIds.includes(shape.id)) {
          return scaleShape(shape, scaleFactor, origin);
        }
        return shape;
      });
      
      // Reset downstream stages when shapes are scaled
      resetDownstreamStages('edit');
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes }
      };
    }),
    
    rotateShapes: (shapeIds: string[], angle: number, origin: Point2D) => update(state => {
      if (!state.drawing) return state;
      
      const shapes: Shape[] = state.drawing.shapes.map(shape => {
        if (shapeIds.includes(shape.id)) {
          return rotateShape(shape, angle, origin);
        }
        return shape;
      });
      
      // Reset downstream stages when shapes are rotated
      resetDownstreamStages('edit');
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes }
      };
    }),
    
    setViewTransform: (scale: number, offset: Point2D) => update(state => ({
      ...state,
      scale,
      offset
    })),
    
    setLayerVisibility: (layerName: string, visible: boolean) => update(state => ({
      ...state,
      layerVisibility: {
        ...state.layerVisibility,
        [layerName]: visible
      }
    })),
    
    setHoveredShape: (shapeId: string | null) => update(state => ({
      ...state,
      hoveredShape: shapeId
    })),
    
    setDisplayUnit: (unit: 'mm' | 'inch') => update(state => ({
      ...state,
      displayUnit: unit
    })),

    replaceAllShapes: (shapes: Shape[]) => update(state => {
      if (!state.drawing) return state;
      
      // Reset downstream stages when shapes are replaced (this happens during prepare stage operations)
      resetDownstreamStages('prepare');
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes },
        selectedShapes: new Set() // Clear selection since shape IDs may have changed
      };
    }),
    
    // Special method for restoring state without resetting downstream stages
    restoreDrawing: (drawing: Drawing, fileName: string | null, scale: number, offset: Point2D, displayUnit: 'mm' | 'inch', selectedShapes: Set<string>, hoveredShape: string | null) => {
      return update(state => ({ 
        ...state,
        drawing,
        fileName,
        scale,
        offset,
        displayUnit,
        selectedShapes,
        hoveredShape,
        isDragging: false,
        dragStart: null
      }));
    }
  };
}

export const drawingStore: ReturnType<typeof createDrawingStore> = createDrawingStore();