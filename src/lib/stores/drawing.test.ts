import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { drawingStore } from './drawing';
import type { Drawing, Shape, Point2D } from '../types';

// Mock dependent modules
vi.mock('./chains', () => ({
  clearChains: vi.fn()
}));

vi.mock('./parts', () => ({
  clearParts: vi.fn()
}));

vi.mock('$lib/geometry', () => ({
  moveShape: vi.fn((shape: Shape, delta: Point2D) => ({
    ...shape,
    geometry: {
      ...shape.geometry,
      start: { x: shape.geometry.start.x + delta.x, y: shape.geometry.start.y + delta.y },
      end: { x: shape.geometry.end.x + delta.x, y: shape.geometry.end.y + delta.y }
    }
  })),
  rotateShape: vi.fn((shape: Shape, angle: number, origin: Point2D) => ({
    ...shape,
    geometry: { ...shape.geometry, rotated: true }
  })),
  scaleShape: vi.fn((shape: Shape, scale: number, origin: Point2D) => ({
    ...shape,
    geometry: { ...shape.geometry, scaled: scale }
  }))
}));

// Mock overlay store
const mockOverlayStore = {
  clearStageOverlay: vi.fn()
};

// Mock tessellation store
const mockTessellationStore = {
  clearTessellation: vi.fn()
};

// Mock path store
const mockPathStore = {
  reset: vi.fn()
};

// Mock operations store
const mockOperationsStore = {
  reset: vi.fn()
};

// Mock rapid store
const mockRapidStore = {
  reset: vi.fn()
};

// Mock workflow store
const mockWorkflowStore = {
  invalidateDownstreamStages: vi.fn()
};

// Mock the dynamic imports
vi.mock('./overlay', () => ({
  overlayStore: mockOverlayStore
}));

vi.mock('./tessellation', () => ({
  tessellationStore: mockTessellationStore
}));

vi.mock('./paths', () => ({
  pathStore: mockPathStore
}));

vi.mock('./operations', () => ({
  operationsStore: mockOperationsStore
}));

vi.mock('./rapids', () => ({
  rapidStore: mockRapidStore
}));

vi.mock('./workflow', () => ({
  workflowStore: mockWorkflowStore
}));

describe('drawingStore', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  const createTestDrawing = (): Drawing => ({
    shapes: [
      {
        id: 'line-1',
        type: 'line',
        geometry: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 }
        }
      },
      {
        id: 'circle-1',
        type: 'circle',
        geometry: {
          center: { x: 5, y: 5 },
          radius: 3
        }
      }
    ],
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: 10, y: 10 }
    },
    layers: ['Layer1', 'Layer2'],
    units: 'mm'
  });

  describe('setDrawing', () => {
    it('should set drawing and reset state', async () => {
      const drawing = createTestDrawing();
      
      await drawingStore.setDrawing(drawing, 'test.dxf');

      const state = get(drawingStore);
      expect(state.drawing).toEqual(drawing);
      expect(state.fileName).toBe('test.dxf');
      expect(state.displayUnit).toBe('mm');
      expect(state.scale).toBe(1);
      expect(state.offset).toEqual({ x: 0, y: 0 });
      expect(state.selectedShapes.size).toBe(0);
      expect(state.hoveredShape).toBeNull();
    });

    it('should reset downstream stages', async () => {
      const drawing = createTestDrawing();
      
      await drawingStore.setDrawing(drawing);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockOverlayStore.clearStageOverlay).toHaveBeenCalledWith('prepare');
      expect(mockOverlayStore.clearStageOverlay).toHaveBeenCalledWith('program');
      expect(mockPathStore.reset).toHaveBeenCalled();
      expect(mockOperationsStore.reset).toHaveBeenCalled();
      expect(mockWorkflowStore.invalidateDownstreamStages).toHaveBeenCalledWith('edit');
    });

    it('should handle drawing without filename', async () => {
      const drawing = createTestDrawing();
      
      await drawingStore.setDrawing(drawing);

      const state = get(drawingStore);
      expect(state.fileName).toBeNull();
    });
  });

  describe('selectShape', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
    });

    it('should select single shape', () => {
      drawingStore.selectShape('line-1');

      const state = get(drawingStore);
      expect(state.selectedShapes.has('line-1')).toBe(true);
      expect(state.selectedShapes.size).toBe(1);
    });

    it('should replace selection when multi is false', () => {
      drawingStore.selectShape('line-1');
      drawingStore.selectShape('circle-1'); // Should replace, not add

      const state = get(drawingStore);
      expect(state.selectedShapes.has('line-1')).toBe(false);
      expect(state.selectedShapes.has('circle-1')).toBe(true);
      expect(state.selectedShapes.size).toBe(1);
    });

    it('should add to selection when multi is true', () => {
      drawingStore.selectShape('line-1');
      drawingStore.selectShape('circle-1', true); // Should add

      const state = get(drawingStore);
      expect(state.selectedShapes.has('line-1')).toBe(true);
      expect(state.selectedShapes.has('circle-1')).toBe(true);
      expect(state.selectedShapes.size).toBe(2);
    });
  });

  describe('deselectShape', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
      drawingStore.selectShape('line-1');
      drawingStore.selectShape('circle-1', true);
    });

    it('should remove shape from selection', () => {
      drawingStore.deselectShape('line-1');

      const state = get(drawingStore);
      expect(state.selectedShapes.has('line-1')).toBe(false);
      expect(state.selectedShapes.has('circle-1')).toBe(true);
      expect(state.selectedShapes.size).toBe(1);
    });

    it('should handle deselecting non-selected shape', () => {
      drawingStore.deselectShape('non-existent');

      const state = get(drawingStore);
      expect(state.selectedShapes.size).toBe(2); // Should remain unchanged
    });
  });

  describe('clearSelection', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
      drawingStore.selectShape('line-1');
      drawingStore.selectShape('circle-1', true);
    });

    it('should clear all selections', () => {
      drawingStore.clearSelection();

      const state = get(drawingStore);
      expect(state.selectedShapes.size).toBe(0);
    });
  });

  describe('deleteSelected', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
      drawingStore.selectShape('line-1');
    });

    it('should delete selected shapes', async () => {
      await drawingStore.deleteSelected();

      const state = get(drawingStore);
      expect(state.drawing?.shapes).toHaveLength(1);
      expect(state.drawing?.shapes[0].id).toBe('circle-1');
      expect(state.selectedShapes.size).toBe(0);
    });

    it('should reset downstream stages when shapes deleted', async () => {
      await drawingStore.deleteSelected();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockWorkflowStore.invalidateDownstreamStages).toHaveBeenCalledWith('edit');
    });

    it('should handle no drawing state', async () => {
      // Reset to no drawing
      const initialState = get(drawingStore);
      expect(initialState.drawing).toBeDefined(); // We have a drawing from beforeEach
      
      // Create a fresh store state with no drawing
      drawingStore.restoreDrawing(null as any, null, 1, { x: 0, y: 0 }, 'mm', new Set(), null);
      
      await drawingStore.deleteSelected();
      
      const state = get(drawingStore);
      expect(state.drawing).toBeNull();
    });
  });

  describe('moveShapes', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
    });

    it('should move specified shapes', async () => {
      const delta = { x: 5, y: 5 };
      
      await drawingStore.moveShapes(['line-1'], delta);

      const state = get(drawingStore);
      expect(state.drawing?.shapes[0].geometry).toHaveProperty('start');
      // The mock should have modified the geometry
    });

    it('should reset downstream stages when shapes moved', async () => {
      await drawingStore.moveShapes(['line-1'], { x: 1, y: 1 });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockWorkflowStore.invalidateDownstreamStages).toHaveBeenCalledWith('edit');
    });

    it('should handle no drawing state', async () => {
      drawingStore.restoreDrawing(null as any, null, 1, { x: 0, y: 0 }, 'mm', new Set(), null);
      
      await drawingStore.moveShapes(['line-1'], { x: 1, y: 1 });
      
      const state = get(drawingStore);
      expect(state.drawing).toBeNull();
    });
  });

  describe('scaleShapes', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
    });

    it('should scale specified shapes', async () => {
      const origin = { x: 0, y: 0 };
      
      await drawingStore.scaleShapes(['line-1'], 2, origin);

      const state = get(drawingStore);
      expect(state.drawing?.shapes[0].geometry).toHaveProperty('scaled', 2);
    });

    it('should reset downstream stages when shapes scaled', async () => {
      await drawingStore.scaleShapes(['line-1'], 2, { x: 0, y: 0 });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockWorkflowStore.invalidateDownstreamStages).toHaveBeenCalledWith('edit');
    });
  });

  describe('rotateShapes', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
    });

    it('should rotate specified shapes', async () => {
      const origin = { x: 5, y: 5 };
      const angle = Math.PI / 4; // 45 degrees
      
      await drawingStore.rotateShapes(['line-1'], angle, origin);

      const state = get(drawingStore);
      expect(state.drawing?.shapes[0].geometry).toHaveProperty('rotated', true);
    });

    it('should reset downstream stages when shapes rotated', async () => {
      await drawingStore.rotateShapes(['line-1'], Math.PI / 4, { x: 0, y: 0 });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockWorkflowStore.invalidateDownstreamStages).toHaveBeenCalledWith('edit');
    });
  });

  describe('setViewTransform', () => {
    it('should update scale and offset', () => {
      const scale = 2;
      const offset = { x: 100, y: 50 };

      drawingStore.setViewTransform(scale, offset);

      const state = get(drawingStore);
      expect(state.scale).toBe(scale);
      expect(state.offset).toEqual(offset);
    });
  });

  describe('setLayerVisibility', () => {
    it('should update layer visibility', () => {
      drawingStore.setLayerVisibility('Layer1', false);

      const state = get(drawingStore);
      expect(state.layerVisibility['Layer1']).toBe(false);
    });

    it('should add new layer visibility setting', () => {
      drawingStore.setLayerVisibility('NewLayer', true);

      const state = get(drawingStore);
      expect(state.layerVisibility['NewLayer']).toBe(true);
    });

    it('should preserve existing layer settings', () => {
      drawingStore.setLayerVisibility('Layer1', false);
      drawingStore.setLayerVisibility('Layer2', true);

      const state = get(drawingStore);
      expect(state.layerVisibility['Layer1']).toBe(false);
      expect(state.layerVisibility['Layer2']).toBe(true);
    });
  });

  describe('setHoveredShape', () => {
    it('should set hovered shape', () => {
      drawingStore.setHoveredShape('line-1');

      const state = get(drawingStore);
      expect(state.hoveredShape).toBe('line-1');
    });

    it('should clear hovered shape', () => {
      drawingStore.setHoveredShape('line-1');
      drawingStore.setHoveredShape(null);

      const state = get(drawingStore);
      expect(state.hoveredShape).toBeNull();
    });
  });

  describe('setDisplayUnit', () => {
    it('should update display unit', () => {
      drawingStore.setDisplayUnit('inch');

      const state = get(drawingStore);
      expect(state.displayUnit).toBe('inch');
    });

    it('should switch between units', () => {
      drawingStore.setDisplayUnit('inch');
      drawingStore.setDisplayUnit('mm');

      const state = get(drawingStore);
      expect(state.displayUnit).toBe('mm');
    });
  });

  describe('replaceAllShapes', () => {
    beforeEach(async () => {
      await drawingStore.setDrawing(createTestDrawing());
      drawingStore.selectShape('line-1');
    });

    it('should replace all shapes', async () => {
      const newShapes: Shape[] = [
        {
          id: 'new-shape-1',
          type: 'line',
          geometry: {
            start: { x: 0, y: 0 },
            end: { x: 20, y: 20 }
          }
        }
      ];

      await drawingStore.replaceAllShapes(newShapes);

      const state = get(drawingStore);
      expect(state.drawing?.shapes).toEqual(newShapes);
      expect(state.selectedShapes.size).toBe(0); // Selection should be cleared
    });

    it('should reset downstream stages from prepare', async () => {
      const newShapes: Shape[] = [];
      
      await drawingStore.replaceAllShapes(newShapes);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockWorkflowStore.invalidateDownstreamStages).toHaveBeenCalledWith('prepare');
    });

    it('should handle no drawing state', async () => {
      drawingStore.restoreDrawing(null as any, null, 1, { x: 0, y: 0 }, 'mm', new Set(), null);
      
      await drawingStore.replaceAllShapes([]);
      
      const state = get(drawingStore);
      expect(state.drawing).toBeNull();
    });
  });

  describe('restoreDrawing', () => {
    it('should restore complete drawing state without resetting downstream stages', () => {
      const drawing = createTestDrawing();
      const selectedShapes = new Set(['line-1']);
      const scale = 2;
      const offset = { x: 100, y: 50 };

      drawingStore.restoreDrawing(
        drawing,
        'restored.dxf',
        scale,
        offset,
        'inch',
        selectedShapes,
        'circle-1'
      );

      const state = get(drawingStore);
      expect(state.drawing).toEqual(drawing);
      expect(state.fileName).toBe('restored.dxf');
      expect(state.scale).toBe(scale);
      expect(state.offset).toEqual(offset);
      expect(state.displayUnit).toBe('inch');
      expect(state.selectedShapes).toEqual(selectedShapes);
      expect(state.hoveredShape).toBe('circle-1');
      expect(state.isDragging).toBe(false);
      expect(state.dragStart).toBeNull();

      // Should NOT have called workflow reset functions
      expect(mockWorkflowStore.invalidateDownstreamStages).not.toHaveBeenCalled();
    });
  });
});