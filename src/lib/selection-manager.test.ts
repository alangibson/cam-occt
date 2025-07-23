import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SelectionManager } from '../selection-manager';
import type { SelectableObject, SelectionCallbacks } from '../selection-manager';

// Mock SelectableObject factory
function createMockObject(shapeIndex: number): SelectableObject {
  const object = new THREE.Object3D() as SelectableObject;
  object.userData = { shapeIndex };
  return object;
}

// Mock intersection factory
function createMockIntersection(object: SelectableObject): THREE.Intersection {
  return {
    distance: 1,
    point: new THREE.Vector3(0, 0, 0),
    object: object,
    face: null,
    faceIndex: null,
    uv: undefined,
    uv1: undefined,
    instanceId: null
  } as THREE.Intersection;
}

describe('SelectionManager', () => {
  let selectionManager: SelectionManager;
  let mockCallbacks: SelectionCallbacks;
  let object1: SelectableObject;
  let object2: SelectableObject;
  let intersection1: THREE.Intersection;
  let intersection2: THREE.Intersection;

  beforeEach(() => {
    // Create mock callbacks
    mockCallbacks = {
      onShapeSelect: vi.fn(),
      onCalculateShapeInfo: vi.fn(() => ({ type: 'test' })),
      onHighlightObject: vi.fn(),
      onAddPointMarkers: vi.fn(),
      onClearPointMarkers: vi.fn()
    };

    // Create test objects
    object1 = createMockObject(1);
    object2 = createMockObject(2);
    intersection1 = createMockIntersection(object1);
    intersection2 = createMockIntersection(object2);

    // Create selection manager
    selectionManager = new SelectionManager(mockCallbacks);
  });

  describe('Initial State', () => {
    it('should start with no selection', () => {
      const state = selectionManager.getSelectionState();
      
      expect(state.hoveredObject).toBeNull();
      expect(state.selectedObject).toBeNull();
      expect(state.pinnedObject).toBeNull();
      expect(state.hasHoveredObject).toBe(false);
      expect(state.hasSelectedObject).toBe(false);
      expect(state.hasPinnedObject).toBe(false);
    });
  });

  describe('Hover Behavior', () => {
    it('should handle hover over object', () => {
      selectionManager.handleHover(object1, intersection1);

      const state = selectionManager.getSelectionState();
      expect(state.hoveredObject).toBe(object1);
      expect(state.selectedObject).toBe(object1);
      expect(state.hasHoveredObject).toBe(true);
      expect(state.hasSelectedObject).toBe(true);

      // Should call callbacks
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, true, 'hover');
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, true, 'selection');
      expect(mockCallbacks.onCalculateShapeInfo).toHaveBeenCalledWith(object1, intersection1);
      expect(mockCallbacks.onShapeSelect).toHaveBeenCalledWith({
        object: object1,
        intersection: intersection1,
        shapeInfo: { type: 'test' }
      });
    });

    it('should handle hover over same object (no duplicate calls)', () => {
      selectionManager.handleHover(object1, intersection1);
      
      // Clear mock call history
      vi.clearAllMocks();
      
      // Hover over same object again
      selectionManager.handleHover(object1, intersection1);

      // Should not call callbacks again
      expect(mockCallbacks.onHighlightObject).not.toHaveBeenCalled();
      expect(mockCallbacks.onShapeSelect).not.toHaveBeenCalled();
    });

    it('should handle hover over different object', () => {
      // First hover
      selectionManager.handleHover(object1, intersection1);
      
      // Clear mocks
      vi.clearAllMocks();
      
      // Second hover
      selectionManager.handleHover(object2, intersection2);

      const state = selectionManager.getSelectionState();
      expect(state.hoveredObject).toBe(object2);
      expect(state.selectedObject).toBe(object2);

      // Should clear previous hover and set new one
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, false, 'hover');
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object2, true, 'hover');
      
      // Should unselect previous and select new
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, false, 'selection');
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object2, true, 'selection');
    });

    it('should handle hover end', () => {
      // First hover to establish state
      selectionManager.handleHover(object1, intersection1);
      
      // Clear mocks
      vi.clearAllMocks();
      
      // End hover
      selectionManager.handleHoverEnd();

      const state = selectionManager.getSelectionState();
      expect(state.hoveredObject).toBeNull();
      expect(state.selectedObject).toBeNull(); // Should unselect when not pinned

      // Should clear hover and selection
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, false, 'hover');
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, false, 'selection');
      expect(mockCallbacks.onShapeSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('Click Behavior (Pinning)', () => {
    it('should handle click to pin object', () => {
      selectionManager.handleClick(object1, intersection1);

      const state = selectionManager.getSelectionState();
      expect(state.pinnedObject).toBe(object1);
      expect(state.selectedObject).toBe(object1);
      expect(state.hasPinnedObject).toBe(true);

      // Should select and highlight
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, true, 'selection');
      expect(mockCallbacks.onShapeSelect).toHaveBeenCalledWith({
        object: object1,
        intersection: intersection1,
        shapeInfo: { type: 'test' }
      });
    });

    it('should handle click on different object (unpin previous)', () => {
      // First click
      selectionManager.handleClick(object1, intersection1);
      
      // Clear mocks
      vi.clearAllMocks();
      
      // Second click
      selectionManager.handleClick(object2, intersection2);

      const state = selectionManager.getSelectionState();
      expect(state.pinnedObject).toBe(object2);
      expect(state.selectedObject).toBe(object2);

      // Should unselect previous and select new
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, false, 'selection');
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object2, true, 'selection');
    });

    it('should handle click on same object (no change)', () => {
      // First click
      selectionManager.handleClick(object1, intersection1);
      
      // Clear mocks
      vi.clearAllMocks();
      
      // Click same object
      selectionManager.handleClick(object1, intersection1);

      // Should not call selection callbacks again (already selected)
      expect(mockCallbacks.onHighlightObject).not.toHaveBeenCalled();
      expect(mockCallbacks.onShapeSelect).not.toHaveBeenCalled();
    });

    it('should handle click on empty space (unpin)', () => {
      // First click to pin
      selectionManager.handleClick(object1, intersection1);
      
      // Clear mocks
      vi.clearAllMocks();
      
      // Click empty space
      selectionManager.handleClickEmpty();

      const state = selectionManager.getSelectionState();
      expect(state.pinnedObject).toBeNull();
      expect(state.selectedObject).toBeNull(); // Should unselect when no hover

      // Should unselect
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, false, 'selection');
      expect(mockCallbacks.onShapeSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('Combined Hover and Click Behavior', () => {
    it('should maintain selection when hovering away from pinned object', () => {
      // Click to pin
      selectionManager.handleClick(object1, intersection1);
      
      // Hover over different object
      selectionManager.handleHover(object2, intersection2);
      
      // Hover away
      selectionManager.handleHoverEnd();

      const state = selectionManager.getSelectionState();
      expect(state.pinnedObject).toBe(object1);
      expect(state.selectedObject).toBe(object1); // Should stay selected
      expect(state.hoveredObject).toBeNull();
    });

    it('should handle hover over pinned object', () => {
      // Click to pin
      selectionManager.handleClick(object1, intersection1);
      
      // Clear mocks
      vi.clearAllMocks();
      
      // Hover over same pinned object
      selectionManager.handleHover(object1, intersection1);

      const state = selectionManager.getSelectionState();
      expect(state.hoveredObject).toBe(object1);
      expect(state.pinnedObject).toBe(object1);
      expect(state.selectedObject).toBe(object1);

      // Should apply hover highlighting but not change selection
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object1, true, 'hover');
      expect(mockCallbacks.onShapeSelect).not.toHaveBeenCalled(); // Already selected
    });

    it('should not select different object when something is pinned', () => {
      // Click to pin object1
      selectionManager.handleClick(object1, intersection1);
      
      // Clear mocks  
      vi.clearAllMocks();
      
      // Hover over object2
      selectionManager.handleHover(object2, intersection2);

      const state = selectionManager.getSelectionState();
      expect(state.hoveredObject).toBe(object2);
      expect(state.selectedObject).toBe(object1); // Should remain object1
      expect(state.pinnedObject).toBe(object1);

      // Should apply hover highlighting to object2 but not select it
      expect(mockCallbacks.onHighlightObject).toHaveBeenCalledWith(object2, true, 'hover');
      expect(mockCallbacks.onShapeSelect).not.toHaveBeenCalled(); // Should not select object2
    });

    it('should handle complex workflow: hover → click → hover away → hover back', () => {
      // Step 1: Hover to select
      selectionManager.handleHover(object1, intersection1);
      let state = selectionManager.getSelectionState();
      expect(state.selectedObject).toBe(object1);
      expect(state.pinnedObject).toBeNull();

      // Step 2: Click to pin
      selectionManager.handleClick(object1, intersection1);
      state = selectionManager.getSelectionState();
      expect(state.selectedObject).toBe(object1);
      expect(state.pinnedObject).toBe(object1);

      // Step 3: Hover away (should stay selected because pinned)
      selectionManager.handleHoverEnd();
      state = selectionManager.getSelectionState();
      expect(state.selectedObject).toBe(object1);
      expect(state.pinnedObject).toBe(object1);
      expect(state.hoveredObject).toBeNull();

      // Step 4: Hover back over pinned object
      selectionManager.handleHover(object1, intersection1);
      state = selectionManager.getSelectionState();
      expect(state.selectedObject).toBe(object1);
      expect(state.pinnedObject).toBe(object1);
      expect(state.hoveredObject).toBe(object1);

      // Step 5: Click empty space to unpin
      selectionManager.handleClickEmpty();
      state = selectionManager.getSelectionState();
      expect(state.selectedObject).toBe(object1); // Should still be selected (hovering)
      expect(state.pinnedObject).toBeNull();
      expect(state.hoveredObject).toBe(object1);
    });
  });

  describe('Shape Index Comparison', () => {
    it('should treat objects with same shape index as the same shape', () => {
      // Create two different object instances with same shape index
      const objectA = createMockObject(5);
      const objectB = createMockObject(5);
      const intersectionA = createMockIntersection(objectA);
      const intersectionB = createMockIntersection(objectB);

      // Pin first object
      selectionManager.handleClick(objectA, intersectionA);
      
      // Hover over second object with same shape index
      selectionManager.handleHover(objectB, intersectionB);

      const state = selectionManager.getSelectionState();
      expect(state.pinnedShapeIndex).toBe(5);
      expect(state.hoveredShapeIndex).toBe(5);
      expect(state.selectedShapeIndex).toBe(5);
      
      // Should treat as same shape - should select objectB when hovering
      expect(state.selectedObject).toBe(objectB);
    });
  });

  describe('Utility Methods', () => {
    it('should clear all selection state', () => {
      // Set up some state
      selectionManager.handleClick(object1, intersection1);
      selectionManager.handleHover(object2, intersection2);
      
      // Clear all
      selectionManager.clearAll();

      const state = selectionManager.getSelectionState();
      expect(state.hoveredObject).toBeNull();
      expect(state.selectedObject).toBeNull();
      expect(state.pinnedObject).toBeNull();
    });

    it('should update callbacks', () => {
      const newCallbacks = { onShapeSelect: vi.fn() };
      selectionManager.setCallbacks(newCallbacks);
      
      selectionManager.handleHover(object1, intersection1);
      
      expect(newCallbacks.onShapeSelect).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined objects gracefully', () => {
      const state = selectionManager.getSelectionState();
      
      expect(state.hoveredShapeIndex).toBeUndefined();
      expect(state.selectedShapeIndex).toBeUndefined();
      expect(state.pinnedShapeIndex).toBeUndefined();
    });

    it('should handle objects without shapeIndex', () => {
      const objectWithoutIndex = new THREE.Object3D() as SelectableObject;
      objectWithoutIndex.userData = { shapeIndex: undefined } as any;
      
      // Should not crash
      expect(() => {
        selectionManager.handleHover(objectWithoutIndex, createMockIntersection(objectWithoutIndex));
      }).not.toThrow();
    });

    it('should handle missing callbacks gracefully', () => {
      const managerWithoutCallbacks = new SelectionManager();
      
      // Should not crash when callbacks are not provided
      expect(() => {
        managerWithoutCallbacks.handleHover(object1, intersection1);
        managerWithoutCallbacks.handleClick(object1, intersection1);
        managerWithoutCallbacks.handleClickEmpty();
        managerWithoutCallbacks.handleHoverEnd();
      }).not.toThrow();
    });
  });
});