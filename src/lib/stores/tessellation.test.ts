import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { tessellationStore, type TessellationPoint } from './tessellation';

describe('tessellationStore', () => {
  beforeEach(() => {
    tessellationStore.clearTessellation();
  });

  const createTestPoints = (): TessellationPoint[] => [
    { x: 0, y: 0, shapeId: 'shape-1', chainId: 'chain-1' },
    { x: 5, y: 5, shapeId: 'shape-1', chainId: 'chain-1' },
    { x: 10, y: 10, shapeId: 'shape-2', chainId: 'chain-1' }
  ];

  describe('initial state', () => {
    it('should start with inactive tessellation and empty points', () => {
      const state = get(tessellationStore);
      
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);
      expect(state.lastUpdate).toBeGreaterThan(0);
    });
  });

  describe('setTessellation', () => {
    it('should set tessellation points and activate', () => {
      vi.useFakeTimers();
      const mockTime = 1000000;
      vi.setSystemTime(mockTime);
      
      const points = createTestPoints();
      tessellationStore.setTessellation(points);

      const state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toEqual(points);
      expect(state.lastUpdate).toBe(mockTime);
      
      vi.useRealTimers();
    });

    it('should replace existing points', () => {
      const initialPoints = [{ x: 0, y: 0, shapeId: 'old', chainId: 'old-chain' }];
      const newPoints = createTestPoints();

      tessellationStore.setTessellation(initialPoints);
      tessellationStore.setTessellation(newPoints);

      const state = get(tessellationStore);
      expect(state.points).toEqual(newPoints);
      expect(state.points).toHaveLength(3);
    });

    it('should activate tessellation even with empty points', () => {
      tessellationStore.setTessellation([]);

      const state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toHaveLength(0);
    });

    it('should update lastUpdate timestamp', () => {
      vi.useFakeTimers();
      const time1 = 1000000;
      const time2 = 2000000;

      vi.setSystemTime(time1);
      tessellationStore.setTessellation([]);
      const state1 = get(tessellationStore);

      vi.setSystemTime(time2);
      tessellationStore.setTessellation(createTestPoints());
      const state2 = get(tessellationStore);

      expect(state1.lastUpdate).toBe(time1);
      expect(state2.lastUpdate).toBe(time2);
      expect(state2.lastUpdate).toBeGreaterThan(state1.lastUpdate);
      
      vi.useRealTimers();
    });
  });

  describe('clearTessellation', () => {
    it('should clear tessellation and deactivate', () => {
      vi.useFakeTimers();
      const mockTime = 1000000;
      
      // First set some points
      tessellationStore.setTessellation(createTestPoints());
      
      // Then clear
      vi.setSystemTime(mockTime);
      tessellationStore.clearTessellation();

      const state = get(tessellationStore);
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);
      expect(state.lastUpdate).toBe(mockTime);
      
      vi.useRealTimers();
    });

    it('should handle clearing when already inactive', () => {
      tessellationStore.clearTessellation();
      tessellationStore.clearTessellation(); // Clear again

      const state = get(tessellationStore);
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);
    });

    it('should update lastUpdate timestamp when clearing', () => {
      vi.useFakeTimers();
      const time1 = 1000000;
      const time2 = 2000000;

      vi.setSystemTime(time1);
      tessellationStore.setTessellation(createTestPoints());

      vi.setSystemTime(time2);
      tessellationStore.clearTessellation();
      const state = get(tessellationStore);

      expect(state.lastUpdate).toBe(time2);
      
      vi.useRealTimers();
    });
  });

  describe('toggleTessellation', () => {
    it('should activate when currently inactive', () => {
      vi.useFakeTimers();
      const mockTime = 1000000;
      vi.setSystemTime(mockTime);
      
      const points = createTestPoints();
      tessellationStore.toggleTessellation(points);

      const state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toEqual(points);
      expect(state.lastUpdate).toBe(mockTime);
      
      vi.useRealTimers();
    });

    it('should deactivate when currently active', () => {
      vi.useFakeTimers();
      const mockTime = 1000000;
      
      // First activate
      tessellationStore.setTessellation(createTestPoints());
      
      // Then toggle (should deactivate)
      vi.setSystemTime(mockTime);
      tessellationStore.toggleTessellation();

      const state = get(tessellationStore);
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);
      expect(state.lastUpdate).toBe(mockTime);
      
      vi.useRealTimers();
    });

    it('should toggle multiple times correctly', () => {
      const points = createTestPoints();

      // Start inactive, toggle to active
      tessellationStore.toggleTessellation(points);
      let state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toEqual(points);

      // Toggle to inactive
      tessellationStore.toggleTessellation();
      state = get(tessellationStore);
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);

      // Toggle back to active with new points
      const newPoints = [{ x: 100, y: 100, shapeId: 'new', chainId: 'new-chain' }];
      tessellationStore.toggleTessellation(newPoints);
      state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toEqual(newPoints);
    });

    it('should activate with empty points when no points provided', () => {
      tessellationStore.toggleTessellation();

      const state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toHaveLength(0);
    });

    it('should activate with provided points when transitioning from inactive', () => {
      const points = createTestPoints();
      tessellationStore.toggleTessellation(points);

      const state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toEqual(points);
    });

    it('should ignore provided points when deactivating', () => {
      const initialPoints = createTestPoints();
      const ignoredPoints = [{ x: 999, y: 999, shapeId: 'ignored', chainId: 'ignored' }];

      // First activate
      tessellationStore.setTessellation(initialPoints);

      // Toggle with different points (should deactivate and ignore the new points)
      tessellationStore.toggleTessellation(ignoredPoints);

      const state = get(tessellationStore);
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);
    });

    it('should update lastUpdate timestamp on toggle', () => {
      vi.useFakeTimers();
      const time1 = 1000000;
      const time2 = 2000000;

      vi.setSystemTime(time1);
      tessellationStore.toggleTessellation(createTestPoints());
      const state1 = get(tessellationStore);

      vi.setSystemTime(time2);
      tessellationStore.toggleTessellation(); // Toggle off
      const state2 = get(tessellationStore);

      expect(state1.lastUpdate).toBe(time1);
      expect(state2.lastUpdate).toBe(time2);
      expect(state2.lastUpdate).toBeGreaterThan(state1.lastUpdate);
      
      vi.useRealTimers();
    });
  });

  describe('complex state transitions', () => {
    it('should handle sequence: set -> toggle -> set -> clear', () => {
      const points1 = createTestPoints();
      const points2 = [{ x: 20, y: 20, shapeId: 'shape-3', chainId: 'chain-2' }];

      // Set initial points
      tessellationStore.setTessellation(points1);
      let state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toEqual(points1);

      // Toggle off
      tessellationStore.toggleTessellation();
      state = get(tessellationStore);
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);

      // Set new points
      tessellationStore.setTessellation(points2);
      state = get(tessellationStore);
      expect(state.isActive).toBe(true);
      expect(state.points).toEqual(points2);

      // Clear
      tessellationStore.clearTessellation();
      state = get(tessellationStore);
      expect(state.isActive).toBe(false);
      expect(state.points).toHaveLength(0);
    });

    it('should preserve point data integrity during operations', () => {
      const originalPoints = createTestPoints();
      
      tessellationStore.setTessellation(originalPoints);
      const state = get(tessellationStore);
      
      // Verify deep equality - the store directly assigns the array reference
      expect(state.points).toEqual(originalPoints);
      expect(state.points).toBe(originalPoints); // Store assigns the reference directly
      expect(state.points[0]).toEqual({ x: 0, y: 0, shapeId: 'shape-1', chainId: 'chain-1' });
    });

    it('should handle multiple rapid state changes', () => {
      vi.useFakeTimers();
      const time = 1000000;

      const operations = [
        () => tessellationStore.setTessellation(createTestPoints()),
        () => tessellationStore.clearTessellation(),
        () => tessellationStore.toggleTessellation([]),
        () => tessellationStore.toggleTessellation(),
        () => tessellationStore.setTessellation([])
      ];

      operations.forEach((op, index) => {
        vi.setSystemTime(time + index * 1000);
        op();
      });

      const finalState = get(tessellationStore);
      expect(finalState.isActive).toBe(true);
      expect(finalState.points).toHaveLength(0);
      expect(finalState.lastUpdate).toBe(time + (operations.length - 1) * 1000);
      
      vi.useRealTimers();
    });
  });
});