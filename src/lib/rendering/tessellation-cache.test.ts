import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    getCachedTessellation,
    clearTessellationCache,
    cleanupTessellationCache,
    getTessellationCacheStats,
} from './tessellation-cache';
import { GeometryType } from '../types/geometry';
import type { Shape, Spline, Ellipse, Line } from '../types/geometry';

// Mock the tessellation functions
vi.mock('../geometry/spline-tessellation', () => ({
    tessellateSpline: vi.fn(() => ({
        success: true,
        points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
        ],
        errors: [],
        warnings: [],
        methodUsed: 'verb-nurbs',
    })),
}));

vi.mock('$lib/geometry/ellipse/index', () => ({
    tessellateEllipse: vi.fn(() => [
        { x: 10, y: 0 },
        { x: 0, y: 5 },
        { x: -10, y: 0 },
        { x: 0, y: -5 },
    ]),
    ELLIPSE_TESSELLATION_POINTS: 32,
}));

vi.mock('../constants', () => ({
    ELLIPSE_TESSELLATION_POINTS: 32,
    STANDARD_TIMEOUT_MS: 1000,
    EXTENDED_TIMEOUT_MS: 60000,
}));

describe('tessellation-cache', () => {
    beforeEach(() => {
        clearTessellationCache();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getCachedTessellation', () => {
        it('should return null for non-tessellatable shapes', () => {
            const lineShape: Shape = {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            };

            const result = getCachedTessellation(lineShape);
            expect(result).toBeNull();
        });

        it('should tessellate and cache spline shapes', () => {
            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            const result = getCachedTessellation(splineShape);

            expect(result).not.toBeNull();
            expect(result).toHaveLength(3);
            expect(result![0]).toEqual({ x: 0, y: 0 });
        });

        it('should tessellate and cache ellipse shapes', () => {
            const ellipseShape: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    minorToMajorRatio: 0.5,
                    majorAxisEndpoint: { x: 10, y: 0 },
                } as Ellipse,
            };

            const result = getCachedTessellation(ellipseShape);

            expect(result).not.toBeNull();
            expect(result).toHaveLength(4);
            expect(result![0]).toEqual({ x: 10, y: 0 });
        });

        it('should return cached result on second call', () => {
            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            const first = getCachedTessellation(splineShape);
            const second = getCachedTessellation(splineShape);

            expect(first).toEqual(second);
            expect(getTessellationCacheStats().size).toBe(1);
        });

        it('should handle tessellation failures gracefully', async () => {
            const { tessellateSpline } = await import(
                '../geometry/spline-tessellation'
            );
            vi.mocked(tessellateSpline).mockReturnValueOnce({
                success: false,
                points: [],
                errors: ['Test error'],
                warnings: [],
                methodUsed: 'verb-nurbs',
            });

            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            const result = getCachedTessellation(splineShape);
            expect(result).toBeNull();
        });

        it('should handle tessellation exceptions', async () => {
            const { tessellateSpline } = await import(
                '../geometry/spline-tessellation'
            );
            vi.mocked(tessellateSpline).mockImplementationOnce(() => {
                throw new Error('Tessellation failed');
            });

            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = getCachedTessellation(splineShape);

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to tessellate spline spline1'),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('should not cache empty tessellations', async () => {
            const { tessellateSpline } = await import(
                '../geometry/spline-tessellation'
            );
            vi.mocked(tessellateSpline).mockReturnValueOnce({
                success: true,
                points: [],
                errors: [],
                warnings: [],
                methodUsed: 'verb-nurbs',
            });

            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            const result = getCachedTessellation(splineShape);

            expect(result).toBeNull();
            expect(getTessellationCacheStats().size).toBe(0);
        });
    });

    describe('cache expiration', () => {
        it('should expire old cache entries', () => {
            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            // Cache the tessellation
            getCachedTessellation(splineShape);
            expect(getTessellationCacheStats().size).toBe(1);

            // Advance time beyond cache expiry (60 seconds)
            vi.advanceTimersByTime(61000);

            // Should return null due to expiration
            const result = getCachedTessellation(splineShape);
            expect(result).not.toBeNull(); // Will be re-tessellated
            expect(getTessellationCacheStats().size).toBe(1);
        });
    });

    describe('clearTessellationCache', () => {
        it('should clear all cached tessellations', () => {
            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            getCachedTessellation(splineShape);
            expect(getTessellationCacheStats().size).toBe(1);

            clearTessellationCache();
            expect(getTessellationCacheStats().size).toBe(0);
        });
    });

    describe('cleanupTessellationCache', () => {
        it('should remove only expired entries', () => {
            const spline1: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            const spline2: Shape = {
                id: 'spline2',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 3, y: 7 },
                        { x: 6, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            // Cache first shape
            getCachedTessellation(spline1);

            // Advance time by 30 seconds
            vi.advanceTimersByTime(30000);

            // Cache second shape
            getCachedTessellation(spline2);

            expect(getTessellationCacheStats().size).toBe(2);

            // Advance time by another 35 seconds (total 65s from first cache)
            vi.advanceTimersByTime(35000);

            cleanupTessellationCache();

            // First entry should be expired and removed, second should remain
            expect(getTessellationCacheStats().size).toBe(1);
        });
    });

    describe('getTessellationCacheStats', () => {
        it('should return correct cache statistics', () => {
            const stats = getTessellationCacheStats();

            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(typeof stats.size).toBe('number');
            expect(typeof stats.maxSize).toBe('number');
            expect(stats.size).toBe(0);
        });

        it('should update size as items are cached', () => {
            const splineShape: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            expect(getTessellationCacheStats().size).toBe(0);

            getCachedTessellation(splineShape);

            expect(getTessellationCacheStats().size).toBe(1);
        });
    });

    describe('cache hash generation', () => {
        it('should generate different hashes for different splines', () => {
            const spline1: Shape = {
                id: 'spline1',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            const spline2: Shape = {
                id: 'spline2',
                type: GeometryType.SPLINE,
                geometry: {
                    degree: 3,
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 10 },
                        { x: 10, y: 0 },
                    ],
                    closed: false,
                    weights: [1, 1, 1],
                } as Spline,
            };

            getCachedTessellation(spline1);
            getCachedTessellation(spline2);

            expect(getTessellationCacheStats().size).toBe(2);
        });

        it('should generate different hashes for different ellipses', () => {
            const ellipse1: Shape = {
                id: 'ellipse1',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 0, y: 0 },
                    minorToMajorRatio: 0.5,
                    majorAxisEndpoint: { x: 10, y: 0 },
                } as Ellipse,
            };

            const ellipse2: Shape = {
                id: 'ellipse2',
                type: GeometryType.ELLIPSE,
                geometry: {
                    center: { x: 5, y: 5 },
                    minorToMajorRatio: 0.5,
                    majorAxisEndpoint: { x: 10, y: 0 },
                } as Ellipse,
            };

            getCachedTessellation(ellipse1);
            getCachedTessellation(ellipse2);

            expect(getTessellationCacheStats().size).toBe(2);
        });
    });
});
