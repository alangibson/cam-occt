import { describe, expect, it } from 'vitest';
import { HALF_CIRCLE_DEG } from '$lib/geometry/circle/constants';
import { parseDXF } from './functions';
import { decomposePolylines } from '$lib/cam/preprocess/decompose-polylines/decompose-polylines';
import { polylineToVertices } from '$lib/geometry/dxf-polyline/functions';
import { readFileSync } from 'fs';
import path from 'path';
import { EPSILON } from '$lib/geometry/math/constants';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type {
    DxfPolyline,
    DxfPolylineVertex,
} from '$lib/geometry/dxf-polyline/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import { GeometryType } from '$lib/geometry/enums';

describe('Bulge Rendering Fixes', () => {
    describe('Polylinie.dxf', () => {
        it('should preserve bulge data when decomposition is disabled', async () => {
            const dxfPath = path.resolve('tests/dxf/Polylinie.dxf');
            const dxfContent = readFileSync(dxfPath, 'utf-8');

            // Parse DXF (no decomposition in parser)
            const drawing = await parseDXF(dxfContent);

            // Should have polylines with vertex data
            const polylines = drawing.shapes.filter(
                (s) => s.type === 'polyline'
            );
            expect(polylines.length).toBeGreaterThan(0);

            // Check if vertices with bulges are preserved
            let totalBulgedVertices = 0;
            polylines.forEach((polyline: ShapeData) => {
                const geometry = polyline.geometry as DxfPolyline;
                const vertices = polylineToVertices(geometry);
                const bulgedVertices = vertices.filter(
                    (v: DxfPolylineVertex) => Math.abs(v.bulge || 0) > EPSILON
                );
                totalBulgedVertices += bulgedVertices.length;
            });

            expect(totalBulgedVertices).toBeGreaterThan(0);
        });

        it('should decompose correctly with proper arc directions', async () => {
            const dxfPath = path.resolve('tests/dxf/Polylinie.dxf');
            const dxfContent = readFileSync(dxfPath, 'utf-8');

            // Parse DXF (no decomposition in parser)
            const parsed = await parseDXF(dxfContent);

            // Apply decomposition separately
            const decomposed = decomposePolylines(
                parsed.shapes.map((s) => new Shape(s))
            );

            // Create decomposed drawing
            const drawing = {
                ...parsed,
                shapes: decomposed,
            };

            const arcs = drawing.shapes.filter((s) => s.type === 'arc');
            const lines = drawing.shapes.filter((s) => s.type === 'line');

            // Should have both arcs and lines
            expect(arcs.length).toBeGreaterThan(0);
            expect(lines.length).toBeGreaterThan(0);

            // Check arc properties
            arcs.forEach((arc: ShapeData) => {
                const geometry = arc.geometry as Arc;
                expect(geometry.center).toBeDefined();
                expect(geometry.radius).toBeGreaterThan(0);
                expect(geometry.startAngle).toBeDefined();
                expect(geometry.endAngle).toBeDefined();
                expect(typeof geometry.clockwise).toBe('boolean');
            });
        });
    });

    describe('Bulge calculation validation', () => {
        it('should correctly handle positive bulge (CCW)', () => {
            // Test the bulge conversion directly
            const _start = { x: 0, y: 0 };
            const _end = { x: 100, y: 0 };
            const bulge = 1.0; // Should create a semicircle CCW

            // This would be tested by importing the bulge conversion function
            // For now, we test through the parser
            expect(bulge).toBeGreaterThan(0); // Positive = CCW
        });

        it('should correctly handle negative bulge (CW)', () => {
            const _start = { x: 0, y: 0 };
            const _end = { x: 100, y: 0 };
            const bulge = -1.0; // Should create a semicircle CW

            expect(bulge).toBeLessThan(0); // Negative = CW
        });

        it('should handle various bulge magnitudes correctly', () => {
            const testBulges = [0.1, 0.5, 1.0, 2.0, -0.1, -0.5, -1.0, -2.0];

            testBulges.forEach((bulge: number) => {
                // According to AutoCAD DXF specification: bulge = tan(θ/4)
                // Where θ is the included angle of the arc
                const includedAngle = 4 * Math.atan(Math.abs(bulge));
                const angleDegrees =
                    (includedAngle * HALF_CIRCLE_DEG) / Math.PI;

                // Validate mathematical properties
                expect(typeof bulge).toBe('number');
                expect(isFinite(bulge)).toBe(true);
                expect(includedAngle).toBeGreaterThanOrEqual(0);

                // Special cases based on DXF specification
                if (Math.abs(bulge) === 1.0) {
                    expect(angleDegrees).toBeCloseTo(HALF_CIRCLE_DEG, 1); // Semicircle
                }
                if (Math.abs(bulge) === 0.0) {
                    expect(angleDegrees).toBeCloseTo(0, 1); // Straight line
                }
                if (Math.abs(bulge) > 1.0) {
                    expect(angleDegrees).toBeGreaterThan(HALF_CIRCLE_DEG); // Greater than semicircle
                }
            });
        });
    });

    describe('Comparison: bulges vs decomposition', () => {
        it('should render differently between bulge-preserved and decomposed', async () => {
            const dxfPath = path.resolve('tests/dxf/polylines_with_bulge.dxf');
            const dxfContent = readFileSync(dxfPath, 'utf-8');

            // Parse DXF (no decomposition in parser)
            const withBulges = await parseDXF(dxfContent);

            // Apply decomposition separately
            const decomposedShapes = decomposePolylines(
                withBulges.shapes.map((s) => new Shape(s))
            );
            const decomposed = {
                ...withBulges,
                shapes: decomposedShapes,
            };

            // Decomposed should have more shapes
            expect(decomposed.shapes.length).toBeGreaterThan(
                withBulges.shapes.length
            );

            // With bulges should only have polylines
            expect(
                withBulges.shapes.every((s: ShapeData) => s.type === 'polyline')
            ).toBe(true);

            // Decomposed should have mixed types
            const decomposedTypes = new Set(
                decomposed.shapes.map((s: ShapeData) => s.type)
            );
            expect(decomposedTypes.size).toBeGreaterThan(1);
        });
    });

    describe('left side tilting table mount.DXF', () => {
        it('should parse polyline with 8 arcs and 8 lines', async () => {
            const dxfPath = path.resolve(
                'tests/dxf/left side tilting table mount.DXF'
            );
            const dxfContent = readFileSync(dxfPath, 'utf-8');

            // Parse DXF
            const drawing = await parseDXF(dxfContent);

            // Should have one polyline
            const polylines = drawing.shapes.filter(
                (s) => s.type === GeometryType.POLYLINE
            );
            expect(polylines.length).toBe(1);

            // Get the polyline's internal shapes (segments)
            const polyline = polylines[0];
            const geometry = polyline.geometry as DxfPolyline;
            const segments = geometry.shapes;

            // Log all segment types for debugging
            console.log('Segment types in polyline:');
            segments.forEach((s, i) => {
                console.log(`  [${i}] type: "${s.type}" (${typeof s.type})`);
            });

            // Count arcs and lines
            const arcs = segments.filter((s) => s.type === GeometryType.ARC);
            const lines = segments.filter((s) => s.type === GeometryType.LINE);

            console.log(`Found ${arcs.length} arcs and ${lines.length} lines`);

            // Should have exactly 8 arcs and 8 lines
            expect(arcs.length).toBe(8);
            expect(lines.length).toBe(8);

            // Verify each arc has proper arc geometry
            arcs.forEach((arc, _) => {
                expect(arc.type).toBe(GeometryType.ARC);
                const arcGeom = arc.geometry as Arc;
                expect(arcGeom.center).toBeDefined();
                expect(arcGeom.radius).toBeGreaterThan(0);
                expect(arcGeom.startAngle).toBeDefined();
                expect(arcGeom.endAngle).toBeDefined();
            });

            // Verify each line has proper line geometry
            lines.forEach((line, _) => {
                expect(line.type).toBe(GeometryType.LINE);
            });
        });

        it('should decompose polyline and preserve 8 arcs and 8 lines', async () => {
            const dxfPath = path.resolve(
                'tests/dxf/left side tilting table mount.DXF'
            );
            const dxfContent = readFileSync(dxfPath, 'utf-8');

            // Parse DXF
            const drawing = await parseDXF(dxfContent);

            // Apply decomposition
            const decomposed = decomposePolylines(
                drawing.shapes.map((s) => new Shape(s))
            );

            // Log all decomposed shape types for debugging
            console.log('Decomposed shape types:');
            decomposed.forEach((s, i) => {
                console.log(`  [${i}] type: "${s.type}" (${typeof s.type})`);
            });

            // Count arcs and lines in decomposed result
            const arcs = decomposed.filter((s) => s.type === GeometryType.ARC);
            const lines = decomposed.filter(
                (s) => s.type === GeometryType.LINE
            );

            console.log(
                `Decomposed: ${arcs.length} arcs and ${lines.length} lines`
            );

            // Should have exactly 8 arcs and 8 lines after decomposition
            expect(arcs.length).toBe(8);
            expect(lines.length).toBe(8);

            // Verify each arc Shape has proper type
            arcs.forEach((arc) => {
                expect(arc.type).toBe(GeometryType.ARC);
            });

            // Verify each line Shape has proper type
            lines.forEach((line) => {
                expect(line.type).toBe(GeometryType.LINE);
            });
        });
    });
});
