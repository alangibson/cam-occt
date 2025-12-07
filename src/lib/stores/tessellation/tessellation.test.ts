import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tessellationStore } from './store.svelte';
import type { TessellationPoint } from './interfaces';

describe('tessellationStore', () => {
    beforeEach(() => {
        tessellationStore.clearTessellation();
    });

    const createTestPoints = (): TessellationPoint[] => [
        { x: 0, y: 0, shapeId: 'shape-1', chainId: 'chain-1' },
        { x: 5, y: 5, shapeId: 'shape-1', chainId: 'chain-1' },
        { x: 10, y: 10, shapeId: 'shape-2', chainId: 'chain-1' },
    ];

    describe('initial state', () => {
        it('should start with inactive tessellation and empty points', () => {
            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);
            expect(tessellationStore.lastUpdate).toBeGreaterThan(0);
        });
    });

    describe('setTessellation', () => {
        it('should set tessellation points and activate', () => {
            vi.useFakeTimers();
            const mockTime = 1000000;
            vi.setSystemTime(mockTime);

            const points = createTestPoints();
            tessellationStore.setTessellation(points);

            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toEqual(points);
            expect(tessellationStore.lastUpdate).toBe(mockTime);

            vi.useRealTimers();
        });

        it('should replace existing points', () => {
            const initialPoints = [
                { x: 0, y: 0, shapeId: 'old', chainId: 'old-chain' },
            ];
            const newPoints = createTestPoints();

            tessellationStore.setTessellation(initialPoints);
            tessellationStore.setTessellation(newPoints);

            expect(tessellationStore.points).toEqual(newPoints);
            expect(tessellationStore.points).toHaveLength(3);
        });

        it('should activate tessellation even with empty points', () => {
            tessellationStore.setTessellation([]);

            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toHaveLength(0);
        });

        it('should update lastUpdate timestamp', () => {
            vi.useFakeTimers();
            const time1 = 1000000;
            const time2 = 2000000;

            vi.setSystemTime(time1);
            tessellationStore.setTessellation([]);
            const lastUpdate1 = tessellationStore.lastUpdate;

            vi.setSystemTime(time2);
            tessellationStore.setTessellation(createTestPoints());
            const lastUpdate2 = tessellationStore.lastUpdate;

            expect(lastUpdate1).toBe(time1);
            expect(lastUpdate2).toBe(time2);
            expect(lastUpdate2).toBeGreaterThan(lastUpdate1);

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

            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);
            expect(tessellationStore.lastUpdate).toBe(mockTime);

            vi.useRealTimers();
        });

        it('should handle clearing when already inactive', () => {
            tessellationStore.clearTessellation();
            tessellationStore.clearTessellation(); // Clear again

            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);
        });

        it('should update lastUpdate timestamp when clearing', () => {
            vi.useFakeTimers();
            const time1 = 1000000;
            const time2 = 2000000;

            vi.setSystemTime(time1);
            tessellationStore.setTessellation(createTestPoints());

            vi.setSystemTime(time2);
            tessellationStore.clearTessellation();

            expect(tessellationStore.lastUpdate).toBe(time2);

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

            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toEqual(points);
            expect(tessellationStore.lastUpdate).toBe(mockTime);

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

            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);
            expect(tessellationStore.lastUpdate).toBe(mockTime);

            vi.useRealTimers();
        });

        it('should toggle multiple times correctly', () => {
            const points = createTestPoints();

            // Start inactive, toggle to active
            tessellationStore.toggleTessellation(points);
            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toEqual(points);

            // Toggle to inactive
            tessellationStore.toggleTessellation();
            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);

            // Toggle back to active with new points
            const newPoints = [
                { x: 100, y: 100, shapeId: 'new', chainId: 'new-chain' },
            ];
            tessellationStore.toggleTessellation(newPoints);
            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toEqual(newPoints);
        });

        it('should activate with empty points when no points provided', () => {
            tessellationStore.toggleTessellation();

            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toHaveLength(0);
        });

        it('should activate with provided points when transitioning from inactive', () => {
            const points = createTestPoints();
            tessellationStore.toggleTessellation(points);

            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toEqual(points);
        });

        it('should ignore provided points when deactivating', () => {
            const initialPoints = createTestPoints();
            const ignoredPoints = [
                { x: 999, y: 999, shapeId: 'ignored', chainId: 'ignored' },
            ];

            // First activate
            tessellationStore.setTessellation(initialPoints);

            // Toggle with different points (should deactivate and ignore the new points)
            tessellationStore.toggleTessellation(ignoredPoints);

            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);
        });

        it('should update lastUpdate timestamp on toggle', () => {
            vi.useFakeTimers();
            const time1 = 1000000;
            const time2 = 2000000;

            vi.setSystemTime(time1);
            tessellationStore.toggleTessellation(createTestPoints());
            const lastUpdate1 = tessellationStore.lastUpdate;

            vi.setSystemTime(time2);
            tessellationStore.toggleTessellation(); // Toggle off
            const lastUpdate2 = tessellationStore.lastUpdate;

            expect(lastUpdate1).toBe(time1);
            expect(lastUpdate2).toBe(time2);
            expect(lastUpdate2).toBeGreaterThan(lastUpdate1);

            vi.useRealTimers();
        });
    });

    describe('complex state transitions', () => {
        it('should handle sequence: set -> toggle -> set -> clear', () => {
            const points1 = createTestPoints();
            const points2 = [
                { x: 20, y: 20, shapeId: 'shape-3', chainId: 'chain-2' },
            ];

            // Set initial points
            tessellationStore.setTessellation(points1);
            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toEqual(points1);

            // Toggle off
            tessellationStore.toggleTessellation();
            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);

            // Set new points
            tessellationStore.setTessellation(points2);
            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toEqual(points2);

            // Clear
            tessellationStore.clearTessellation();
            expect(tessellationStore.isActive).toBe(false);
            expect(tessellationStore.points).toHaveLength(0);
        });

        it('should preserve point data integrity during operations', () => {
            const originalPoints = createTestPoints();

            tessellationStore.setTessellation(originalPoints);

            // Verify deep equality
            expect(tessellationStore.points).toEqual(originalPoints);
            expect(tessellationStore.points[0]).toEqual({
                x: 0,
                y: 0,
                shapeId: 'shape-1',
                chainId: 'chain-1',
            });
        });

        it('should handle multiple rapid state changes', () => {
            vi.useFakeTimers();
            const time = 1000000;

            const operations = [
                () => tessellationStore.setTessellation(createTestPoints()),
                () => tessellationStore.clearTessellation(),
                () => tessellationStore.toggleTessellation([]),
                () => tessellationStore.toggleTessellation(),
                () => tessellationStore.setTessellation([]),
            ];

            operations.forEach((op, index) => {
                vi.setSystemTime(time + index * 1000);
                op();
            });

            expect(tessellationStore.isActive).toBe(true);
            expect(tessellationStore.points).toHaveLength(0);
            expect(tessellationStore.lastUpdate).toBe(
                time + (operations.length - 1) * 1000
            );

            vi.useRealTimers();
        });
    });
});
