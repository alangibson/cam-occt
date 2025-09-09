import { describe, expect, it, vi } from 'vitest';
import {
    GeometryType,
    type Point2D,
    type Shape,
    type Spline,
} from '../../../../types/geometry';
import type { FillOptions, FillResult } from '../types';
import { fillSplineToIntersection } from './index';

// Mock the extend/spline module
vi.mock('../../extend/spline', () => ({
    extendSplineToPoint: vi.fn(),
    determineSplineExtensionDirection: vi.fn(),
    calculateSplineExtension: vi.fn(),
    getSplinePoint: vi.fn(),
}));

describe('Spline Fill Operations', () => {
    const createTestSpline = (points: Point2D[]): Spline => ({
        controlPoints: points,
        degree: 3,
        weights: points.map(() => 1),
        knots: [0, 0, 0, 0, 1, 1, 1, 1],
        fitPoints: [],
        closed: false,
    });

    const createSplineShape = (spline: Spline): Shape => ({
        type: GeometryType.SPLINE,
        geometry: spline,
        id: 'test-spline',
        layer: 'default',
    });

    const createDefaultFillOptions = (): FillOptions => ({
        maxExtension: 100.0,
        tolerance: 1e-6,
        extendDirection: 'auto',
    });

    describe('fillSplineToIntersection', () => {
        it('should successfully extend spline to intersection point', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options = createDefaultFillOptions();

            const extendedSpline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
                { x: 22, y: -2 },
                { x: 25, y: -5 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
                getSplinePoint,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue('end');
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: true,
                extensionDistance: 10.0,
                method: 'linear',
                direction: 'end',
            });
            vi.mocked(getSplinePoint).mockReturnValue({ x: 20, y: 0 });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(true);
            expect(result.extendedShape).not.toBeNull();
            expect(result.extendedShape?.geometry).toBe(extendedSpline);
            expect(result.extension).toBeDefined();
            expect(result.extension?.type).toBe('parametric');
            expect(result.extension?.direction).toBe('end');
            expect(result.extension?.amount).toBe(10.0);
            expect(result.intersectionPoint).toEqual(intersectionPoint);
            expect(result.confidence).toBe(0.8); // Linear method gives 0.8 confidence
            expect(result.warnings).toContain(
                'Spline extended using linear approximation from end tangent'
            );
            expect(result.errors).toHaveLength(0);
        });

        it('should successfully extend spline with parametric method giving higher confidence', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: -5, y: -5 };
            const options = createDefaultFillOptions();

            const extendedSpline = createTestSpline([
                { x: -5, y: -5 },
                { x: -2, y: -2 },
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
                getSplinePoint,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue(
                'start'
            );
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: true,
                extensionDistance: 7.07,
                method: 'parametric',
                direction: 'start',
            });
            vi.mocked(getSplinePoint).mockReturnValue({ x: 0, y: 0 });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(true);
            expect(result.confidence).toBe(0.95); // Parametric method gives high confidence
            expect(result.warnings).toHaveLength(0); // No warning for parametric method
            expect(result.extension?.direction).toBe('start');
        });

        it('should return failure when shape is not a spline', () => {
            const lineShape: Shape = {
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                id: 'test-line',
                layer: 'default',
            };
            const intersectionPoint: Point2D = { x: 15, y: 15 };
            const options = createDefaultFillOptions();

            const result: FillResult = fillSplineToIntersection(
                lineShape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(false);
            expect(result.extendedShape).toBeNull();
            expect(result.errors).toContain('Shape must be a spline');
            expect(result.confidence).toBe(0.0);
        });

        it('should return failure when spline extension fails', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options = createDefaultFillOptions();

            const { extendSplineToPoint } = await import('../../extend/spline');
            vi.mocked(extendSplineToPoint).mockReturnValue(null);

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(false);
            expect(result.extendedShape).toBeNull();
            expect(result.errors).toContain(
                'Failed to extend spline to intersection point'
            );
            expect(result.confidence).toBe(0.0);
        });

        it('should return failure when direction determination fails', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options = createDefaultFillOptions();

            const extendedSpline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
                { x: 25, y: -5 },
            ]);

            const { extendSplineToPoint, determineSplineExtensionDirection } =
                await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue(null);

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(false);
            expect(result.extendedShape).toBeNull();
            expect(result.errors).toContain(
                'Could not determine spline extension direction'
            );
            expect(result.confidence).toBe(0.0);
        });

        it('should return failure when extension calculation fails', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options = createDefaultFillOptions();

            const extendedSpline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
                { x: 25, y: -5 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue('end');
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: false,
                extensionDistance: 0,
                method: 'linear',
                direction: 'end',
                error: 'Extension calculation error',
            });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(false);
            expect(result.extendedShape).toBeNull();
            expect(result.errors).toContain('Extension calculation error');
            expect(result.confidence).toBe(0.0);
        });

        it('should handle specified start direction', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: -5, y: -5 };
            const options: FillOptions = {
                ...createDefaultFillOptions(),
                extendDirection: 'start',
            };

            const extendedSpline = createTestSpline([
                { x: -5, y: -5 },
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
                getSplinePoint,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue(
                'start'
            );
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: true,
                extensionDistance: 7.07,
                method: 'linear',
                direction: 'start',
            });
            vi.mocked(getSplinePoint).mockReturnValue({ x: 0, y: 0 });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(true);
            expect(result.extension?.direction).toBe('start');

            // Verify the correct direction was passed to the extension functions
            expect(extendSplineToPoint).toHaveBeenCalledWith(
                spline,
                intersectionPoint,
                expect.objectContaining({ direction: 'start' })
            );
        });

        it('should handle specified end direction', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options: FillOptions = {
                ...createDefaultFillOptions(),
                extendDirection: 'end',
            };

            const extendedSpline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
                { x: 25, y: -5 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
                getSplinePoint,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue('end');
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: true,
                extensionDistance: 6.4,
                method: 'linear',
                direction: 'end',
            });
            vi.mocked(getSplinePoint).mockReturnValue({ x: 20, y: 0 });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(true);
            expect(result.extension?.direction).toBe('end');

            // Verify the correct direction was passed to the extension functions
            expect(extendSplineToPoint).toHaveBeenCalledWith(
                spline,
                intersectionPoint,
                expect.objectContaining({ direction: 'end' })
            );
        });

        it('should handle extension options correctly', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options: FillOptions = {
                maxExtension: 50.0,
                tolerance: 1e-4,
                extendDirection: 'auto',
            };

            const extendedSpline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
                { x: 25, y: -5 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
                getSplinePoint,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue('end');
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: true,
                extensionDistance: 6.4,
                method: 'linear',
                direction: 'end',
            });
            vi.mocked(getSplinePoint).mockReturnValue({ x: 20, y: 0 });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(true);

            // Verify the options were passed correctly to extension functions
            expect(extendSplineToPoint).toHaveBeenCalledWith(
                spline,
                intersectionPoint,
                expect.objectContaining({
                    maxExtension: 50.0,
                    tolerance: 1e-4,
                    direction: 'auto',
                    method: 'linear',
                })
            );
        });

        it('should handle exceptions gracefully', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options = createDefaultFillOptions();

            const { extendSplineToPoint } = await import('../../extend/spline');
            vi.mocked(extendSplineToPoint).mockImplementation(() => {
                throw new Error('Unexpected error during extension');
            });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(false);
            expect(result.extendedShape).toBeNull();
            expect(result.errors).toContain(
                'Spline extension failed: Unexpected error during extension'
            );
            expect(result.confidence).toBe(0.0);
        });

        it('should handle non-Error exceptions', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options = createDefaultFillOptions();

            const { extendSplineToPoint } = await import('../../extend/spline');
            vi.mocked(extendSplineToPoint).mockImplementation(() => {
                throw 'String error';
            });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(false);
            expect(result.extendedShape).toBeNull();
            expect(result.errors).toContain(
                'Spline extension failed: String error'
            );
            expect(result.confidence).toBe(0.0);
        });

        it('should preserve original shape properties in extended shape', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape: Shape = {
                type: GeometryType.SPLINE,
                geometry: spline,
                id: 'test-spline-123',
                layer: 'layer-1',
            };
            const intersectionPoint: Point2D = { x: 25, y: -5 };
            const options = createDefaultFillOptions();

            const extendedSpline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
                { x: 25, y: -5 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
                getSplinePoint,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue('end');
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: true,
                extensionDistance: 6.4,
                method: 'linear',
                direction: 'end',
            });
            vi.mocked(getSplinePoint).mockReturnValue({ x: 20, y: 0 });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(true);
            expect(result.extendedShape).not.toBeNull();
            expect(result.extendedShape?.type).toBe('spline');
            expect(result.extendedShape?.id).toBe('test-spline-123');
            expect(result.extendedShape?.layer).toBe('layer-1');
            expect(result.extendedShape?.geometry).toBe(extendedSpline);
        });

        it('should create proper shape extension metadata', async () => {
            const spline = createTestSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);
            const shape = createSplineShape(spline);
            const intersectionPoint: Point2D = { x: -10, y: -10 };
            const options = createDefaultFillOptions();

            const extendedSpline = createTestSpline([
                { x: -10, y: -10 },
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
            ]);

            const {
                extendSplineToPoint,
                determineSplineExtensionDirection,
                calculateSplineExtension,
                getSplinePoint,
            } = await import('../../extend/spline');

            vi.mocked(extendSplineToPoint).mockReturnValue(extendedSpline);
            vi.mocked(determineSplineExtensionDirection).mockReturnValue(
                'start'
            );
            vi.mocked(calculateSplineExtension).mockReturnValue({
                success: true,
                extensionDistance: 14.14,
                method: 'linear',
                direction: 'start',
            });
            vi.mocked(getSplinePoint).mockReturnValue({ x: 0, y: 0 });

            const result: FillResult = fillSplineToIntersection(
                shape,
                intersectionPoint,
                options
            );

            expect(result.success).toBe(true);
            expect(result.extension).toBeDefined();

            const extension = result.extension!;
            expect(extension.type).toBe('parametric');
            expect(extension.amount).toBe(14.14);
            expect(extension.direction).toBe('start');
            expect(extension.originalShape).toBe(shape);
            expect(extension.extensionStart).toEqual({ x: 0, y: 0 });
            expect(extension.extensionEnd).toEqual(intersectionPoint);
        });
    });
});
