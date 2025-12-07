import { describe, it, expect } from 'vitest';
import { Shape } from './classes';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';

describe('Shape.clone()', () => {
    it('should create a new shape with a different ID by default', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 },
        };
        const originalShape = new Shape({
            id: 'original-id',
            type: GeometryType.LINE,
            geometry: line,
            layer: 'Layer1',
        });

        const clonedShape = originalShape.clone();

        expect(clonedShape.id).not.toBe(originalShape.id);
        expect(clonedShape.id).toBeDefined();
    });

    it('should preserve ID when preserveId is true', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 },
        };
        const originalShape = new Shape({
            id: 'original-id',
            type: GeometryType.LINE,
            geometry: line,
            layer: 'Layer1',
        });

        const clonedShape = originalShape.clone(true);

        expect(clonedShape.id).toBe('original-id');

        // But geometry should still be deep cloned
        (clonedShape.geometry as Line).start.x = 999;
        expect((originalShape.geometry as Line).start.x).toBe(0);
    });

    it('should deep clone a LINE geometry', () => {
        const line: Line = {
            start: { x: 10, y: 20 },
            end: { x: 30, y: 40 },
        };
        const originalShape = new Shape({
            id: 'line-id',
            type: GeometryType.LINE,
            geometry: line,
            layer: 'Layer1',
        });

        const clonedShape = originalShape.clone();
        const clonedGeometry = clonedShape.geometry as Line;

        // Verify values are copied
        expect(clonedGeometry.start.x).toBe(10);
        expect(clonedGeometry.start.y).toBe(20);
        expect(clonedGeometry.end.x).toBe(30);
        expect(clonedGeometry.end.y).toBe(40);

        // Verify deep copy - modifying clone shouldn't affect original
        clonedGeometry.start.x = 999;
        expect((originalShape.geometry as Line).start.x).toBe(10);
    });

    it('should deep clone an ARC geometry', () => {
        const arc: Arc = {
            center: { x: 50, y: 50 },
            radius: 25,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: true,
        };
        const originalShape = new Shape({
            id: 'arc-id',
            type: GeometryType.ARC,
            geometry: arc,
        });

        const clonedShape = originalShape.clone();
        const clonedGeometry = clonedShape.geometry as Arc;

        // Verify values are copied
        expect(clonedGeometry.center.x).toBe(50);
        expect(clonedGeometry.center.y).toBe(50);
        expect(clonedGeometry.radius).toBe(25);
        expect(clonedGeometry.startAngle).toBe(0);
        expect(clonedGeometry.endAngle).toBe(Math.PI);
        expect(clonedGeometry.clockwise).toBe(true);

        // Verify deep copy
        clonedGeometry.center.x = 999;
        expect((originalShape.geometry as Arc).center.x).toBe(50);
    });

    it('should deep clone a CIRCLE geometry', () => {
        const circle: Circle = {
            center: { x: 100, y: 200 },
            radius: 50,
        };
        const originalShape = new Shape({
            id: 'circle-id',
            type: GeometryType.CIRCLE,
            geometry: circle,
        });

        const clonedShape = originalShape.clone();
        const clonedGeometry = clonedShape.geometry as Circle;

        // Verify values are copied
        expect(clonedGeometry.center.x).toBe(100);
        expect(clonedGeometry.center.y).toBe(200);
        expect(clonedGeometry.radius).toBe(50);

        // Verify deep copy
        clonedGeometry.center.y = 999;
        expect((originalShape.geometry as Circle).center.y).toBe(200);
    });

    it('should deep clone an ELLIPSE geometry', () => {
        const ellipse: Ellipse = {
            center: { x: 75, y: 125 },
            majorAxisEndpoint: { x: 60, y: 0 },
            minorToMajorRatio: 0.5,
        };
        const originalShape = new Shape({
            id: 'ellipse-id',
            type: GeometryType.ELLIPSE,
            geometry: ellipse,
        });

        const clonedShape = originalShape.clone();
        const clonedGeometry = clonedShape.geometry as Ellipse;

        // Verify values are copied
        expect(clonedGeometry.center.x).toBe(75);
        expect(clonedGeometry.center.y).toBe(125);
        expect(clonedGeometry.majorAxisEndpoint.x).toBe(60);
        expect(clonedGeometry.majorAxisEndpoint.y).toBe(0);
        expect(clonedGeometry.minorToMajorRatio).toBe(0.5);

        // Verify deep copy
        clonedGeometry.center.x = 999;
        expect((originalShape.geometry as Ellipse).center.x).toBe(75);
    });

    it('should deep clone a POINT geometry', () => {
        const point: Point2D = { x: 123, y: 456 };
        const originalShape = new Shape({
            id: 'point-id',
            type: GeometryType.POINT,
            geometry: point,
        });

        const clonedShape = originalShape.clone();
        const clonedGeometry = clonedShape.geometry as Point2D;

        // Verify values are copied
        expect(clonedGeometry.x).toBe(123);
        expect(clonedGeometry.y).toBe(456);

        // Verify deep copy
        clonedGeometry.x = 999;
        expect((originalShape.geometry as Point2D).x).toBe(123);
    });

    it('should deep clone a POLYLINE geometry', () => {
        const lineShape = {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        };
        const polyline: DxfPolyline = {
            shapes: [lineShape],
            closed: true,
        };
        const originalShape = new Shape({
            id: 'polyline-id',
            type: GeometryType.POLYLINE,
            geometry: polyline,
        });

        const clonedShape = originalShape.clone();
        const clonedGeometry = clonedShape.geometry as DxfPolyline;

        // Verify values are copied
        expect(clonedGeometry.shapes).toHaveLength(1);
        expect(clonedGeometry.shapes[0].id).toBe('line1');
        expect(clonedGeometry.closed).toBe(true);

        // Verify deep copy - array is cloned
        expect(clonedGeometry.shapes).not.toBe(
            (originalShape.geometry as DxfPolyline).shapes
        );
    });

    it('should deep clone a SPLINE geometry', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 50, y: 100 },
                { x: 100, y: 0 },
            ],
            degree: 2,
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            fitPoints: [
                { x: 0, y: 0 },
                { x: 50, y: 100 },
                { x: 100, y: 0 },
            ],
            closed: false,
        };
        const originalShape = new Shape({
            id: 'spline-id',
            type: GeometryType.SPLINE,
            geometry: spline,
        });

        const clonedShape = originalShape.clone();
        const clonedGeometry = clonedShape.geometry as Spline;

        // Verify values are copied
        expect(clonedGeometry.controlPoints).toHaveLength(3);
        expect(clonedGeometry.controlPoints[1].x).toBe(50);
        expect(clonedGeometry.controlPoints[1].y).toBe(100);
        expect(clonedGeometry.degree).toBe(2);
        expect(clonedGeometry.knots).toHaveLength(6);
        expect(clonedGeometry.weights).toHaveLength(3);
        expect(clonedGeometry.fitPoints).toHaveLength(3);
        expect(clonedGeometry.closed).toBe(false);

        // Verify deep copy - arrays are cloned
        expect(clonedGeometry.controlPoints).not.toBe(
            (originalShape.geometry as Spline).controlPoints
        );
        expect(clonedGeometry.knots).not.toBe(
            (originalShape.geometry as Spline).knots
        );
        expect(clonedGeometry.weights).not.toBe(
            (originalShape.geometry as Spline).weights
        );
        expect(clonedGeometry.fitPoints).not.toBe(
            (originalShape.geometry as Spline).fitPoints
        );

        // Verify deep copy - points are cloned
        clonedGeometry.controlPoints[1].x = 999;
        expect((originalShape.geometry as Spline).controlPoints[1].x).toBe(50);

        // Verify deep copy - arrays are independent
        clonedGeometry.knots[0] = 999;
        expect((originalShape.geometry as Spline).knots[0]).toBe(0);
    });

    it('should preserve layer information', () => {
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
        };
        const originalShape = new Shape({
            id: 'layer-test',
            type: GeometryType.LINE,
            geometry: line,
            layer: 'MyLayer',
        });

        const clonedShape = originalShape.clone();

        expect(clonedShape.layer).toBe('MyLayer');
    });

    it('should preserve type information', () => {
        const circle: Circle = {
            center: { x: 0, y: 0 },
            radius: 10,
        };
        const originalShape = new Shape({
            id: 'type-test',
            type: GeometryType.CIRCLE,
            geometry: circle,
        });

        const clonedShape = originalShape.clone();

        expect(clonedShape.type).toBe(GeometryType.CIRCLE);
    });
});
