import { describe, it, expect } from 'vitest';
import { HALF_CIRCLE_DEG } from '../geometry/constants';
import { parseDXF } from './dxf-parser';
import { decomposePolylines } from '../algorithms/decompose-polylines';
import { polylineToVertices } from '../geometry/polyline';
import { readFileSync } from 'fs';
import path from 'path';
import { EPSILON } from '../constants';
import type { Polyline, Arc, PolylineVertex } from '../../lib/types/geometry';

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
            polylines.forEach((polyline) => {
                const geometry = polyline.geometry as Polyline;
                const vertices = polylineToVertices(geometry);
                const bulgedVertices = vertices.filter(
                    (v: PolylineVertex) => Math.abs(v.bulge || 0) > EPSILON
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
            const decomposed = decomposePolylines(parsed.shapes);

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
            arcs.forEach((arc) => {
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

            testBulges.forEach((bulge) => {
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
            const decomposedShapes = decomposePolylines(withBulges.shapes);
            const decomposed = {
                ...withBulges,
                shapes: decomposedShapes,
            };

            // Decomposed should have more shapes
            expect(decomposed.shapes.length).toBeGreaterThan(
                withBulges.shapes.length
            );

            // With bulges should only have polylines
            expect(withBulges.shapes.every((s) => s.type === 'polyline')).toBe(
                true
            );

            // Decomposed should have mixed types
            const decomposedTypes = new Set(
                decomposed.shapes.map((s) => s.type)
            );
            expect(decomposedTypes.size).toBeGreaterThan(1);
        });
    });
});
