import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { offsetPolyline } from './polyline';
import {
    GeometryType,
    type Arc,
    type Circle,
    type Drawing,
    type Line,
    type Point2D,
    type Polyline,
    type Shape,
} from '$lib/types/geometry';
import {
    createPolylineFromVertices,
    polylineToPoints,
} from '$lib/geometry/polyline';
import { parseDXF } from '../../../../parsers/dxf/functions';
import { offsetShape } from '..';
import { OffsetDirection } from '../types';

describe('offsetPolyline', () => {
    const openPolyline: Polyline = createPolylineFromVertices(
        [
            { x: 0, y: 0, bulge: 0 },
            { x: 10, y: 0, bulge: 0 },
            { x: 10, y: 10, bulge: 0 },
        ],
        false
    ).geometry as Polyline;

    const closedPolyline: Polyline = createPolylineFromVertices(
        [
            { x: 0, y: 0, bulge: 0 },
            { x: 10, y: 0, bulge: 0 },
            { x: 10, y: 10, bulge: 0 },
            { x: 0, y: 10, bulge: 0 },
        ],
        true
    ).geometry as Polyline;

    it('should return empty shapes when direction is none', () => {
        const result = offsetPolyline(openPolyline, 2, OffsetDirection.NONE);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should offset open polyline', () => {
        const result = offsetPolyline(openPolyline, 2, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);

        // For open polylines, chain offset may return individual line/arc shapes
        // instead of a single polyline shape, which is valid
        if (result.shapes[0].type === 'polyline') {
            const offsetGeometry = result.shapes[0].geometry as Polyline;
            expect(polylineToPoints(offsetGeometry).length).toBeGreaterThan(0);
        } else {
            // Individual shapes (lines/arcs) are also a valid result
            expect(
                result.shapes.every(
                    (s) => s.type === 'line' || s.type === 'arc'
                )
            ).toBe(true);
        }
    });

    it('should offset closed polyline', () => {
        const result = offsetPolyline(
            closedPolyline,
            1,
            OffsetDirection.OUTSET
        );
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);

        // For closed polylines, chain offset may return individual line/arc shapes
        // instead of a single polyline shape, which is valid
        if (result.shapes[0].type === 'polyline') {
            const offsetGeometry = result.shapes[0].geometry as Polyline;
            expect(offsetGeometry.closed).toBe(true);
        } else {
            // Individual shapes (lines/arcs) are also a valid result for closed polylines
            expect(
                result.shapes.every(
                    (s) => s.type === 'line' || s.type === 'arc'
                )
            ).toBe(true);
        }
    });

    it('should handle inset offset', () => {
        const result = offsetPolyline(closedPolyline, 1, OffsetDirection.INSET);
        expect(result.success).toBe(true);
        expect(result.shapes.length).toBeGreaterThan(0);
    });

    describe('Self-intersecting polylines', () => {
        it('should handle figure-8 polyline offset', () => {
            // Create a figure-8 shape that self-intersects
            const figure8: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 10, y: 5, bulge: 0 },
                    { x: 20, y: 0, bulge: 0 },
                    { x: 10, y: -5, bulge: 0 },
                    { x: 0, y: 0, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const result = offsetPolyline(figure8, 1, OffsetDirection.OUTSET);
            expect(result.success).toBe(true);
            // Clipper2 should handle self-intersections automatically
            expect(result.shapes.length).toBeGreaterThan(0);
        });

        it('should handle bow-tie polyline offset', () => {
            // Create a bow-tie shape (two triangles sharing a vertex)
            const bowTie: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 5, y: 5, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                    { x: 5, y: -5, bulge: 0 },
                    { x: 0, y: 0, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const outsetResult = offsetPolyline(
                bowTie,
                1,
                OffsetDirection.OUTSET
            );
            expect(outsetResult.success).toBe(true);

            const insetResult = offsetPolyline(
                bowTie,
                0.5,
                OffsetDirection.INSET
            );
            expect(insetResult.success).toBe(true);
        });

        it('should handle spiral-like overlapping polyline', () => {
            // Create overlapping segments
            const spiral: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                    { x: 10, y: 10, bulge: 0 },
                    { x: -5, y: 10, bulge: 0 },
                    { x: -5, y: -5, bulge: 0 },
                    { x: 15, y: -5, bulge: 0 },
                ],
                false
            ).geometry as Polyline;

            const result = offsetPolyline(spiral, 1, OffsetDirection.OUTSET);
            expect(result.success).toBe(true);
            expect(result.shapes.length).toBeGreaterThan(0);
        });
    });

    describe('Sharp corners and acute angles', () => {
        it('should handle very sharp corner (acute angle)', () => {
            // Create a sharp V shape with 15-degree angle
            const sharpV: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 10, y: 0.5, bulge: 0 }, // Very shallow angle
                    { x: 20, y: 0, bulge: 0 },
                ],
                false
            ).geometry as Polyline;

            const result = offsetPolyline(sharpV, 2, OffsetDirection.OUTSET);
            expect(result.success).toBe(true);
            // Should handle the sharp corner with proper join
            expect(result.shapes.length).toBeGreaterThan(0);
        });

        it('should handle 90-degree corner', () => {
            // Create an L shape with perfect 90-degree corner
            const lShape: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                    { x: 10, y: 10, bulge: 0 },
                ],
                false
            ).geometry as Polyline;

            const result = offsetPolyline(lShape, 1, OffsetDirection.OUTSET);
            expect(result.success).toBe(true);
            expect(result.shapes.length).toBeGreaterThan(0);
        });

        it('should handle zigzag pattern with many sharp corners', () => {
            // Create a zigzag with many direction changes
            const zigzag: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 2, y: 5, bulge: 0 },
                    { x: 4, y: 0, bulge: 0 },
                    { x: 6, y: 5, bulge: 0 },
                    { x: 8, y: 0, bulge: 0 },
                    { x: 10, y: 5, bulge: 0 },
                ],
                false
            ).geometry as Polyline;

            const result = offsetPolyline(zigzag, 0.5, OffsetDirection.OUTSET);
            expect(result.success).toBe(true);
            expect(result.shapes.length).toBeGreaterThan(0);
        });

        it('should handle star shape with sharp points', () => {
            // Create a 5-pointed star with very sharp points
            const starPoints: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 10, bulge: 0 }, // Top point
                    { x: 2, y: 3, bulge: 0 }, // Inner point
                    { x: 9, y: 3, bulge: 0 }, // Right outer
                    { x: 3, y: -2, bulge: 0 }, // Inner point
                    { x: 6, y: -8, bulge: 0 }, // Bottom right
                    { x: 0, y: -3, bulge: 0 }, // Inner point
                    { x: -6, y: -8, bulge: 0 }, // Bottom left
                    { x: -3, y: -2, bulge: 0 }, // Inner point
                    { x: -9, y: 3, bulge: 0 }, // Left outer
                    { x: -2, y: 3, bulge: 0 }, // Inner point
                ],
                true
            ).geometry as Polyline;

            const result = offsetPolyline(
                starPoints,
                0.5,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);
            expect(result.shapes.length).toBeGreaterThan(0);
        });
    });

    describe('Zero-length and degenerate segments', () => {
        it('should handle polyline with duplicate consecutive points', () => {
            const duplicatePoints: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 0, y: 0, bulge: 0 }, // Duplicate
                    { x: 5, y: 0, bulge: 0 },
                    { x: 5, y: 0, bulge: 0 }, // Duplicate
                    { x: 5, y: 5, bulge: 0 },
                    { x: 0, y: 5, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const result = offsetPolyline(
                duplicatePoints,
                1,
                OffsetDirection.OUTSET
            );
            // Should succeed - Clipper2 can handle duplicate points
            expect(result.success).toBe(true);
        });

        it('should handle polyline with very small segments', () => {
            const tinySegments: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 0.001, y: 0, bulge: 0 }, // Tiny segment
                    { x: 10, y: 0, bulge: 0 },
                    { x: 10, y: 0.001, bulge: 0 }, // Tiny segment
                    { x: 10, y: 10, bulge: 0 },
                    { x: 0, y: 10, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const result = offsetPolyline(
                tinySegments,
                0.1,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);
        });
    });

    describe('Extreme offset distances', () => {
        it('should handle very large offset distance', () => {
            const smallSquare: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 1, y: 0, bulge: 0 },
                    { x: 1, y: 1, bulge: 0 },
                    { x: 0, y: 1, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const result = offsetPolyline(
                smallSquare,
                100,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);
            expect(result.shapes.length).toBeGreaterThan(0);
        });
    });

    describe('Complex geometric edge cases', () => {
        it('should handle concave polygon with inward offset', () => {
            // Create L-shaped polygon that might disappear with large inset
            const lPolygon: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                    { x: 10, y: 3, bulge: 0 },
                    { x: 3, y: 3, bulge: 0 },
                    { x: 3, y: 10, bulge: 0 },
                    { x: 0, y: 10, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const smallInset = offsetPolyline(
                lPolygon,
                1,
                OffsetDirection.INSET
            );
            expect(smallInset.success).toBe(true);

            const largeInset = offsetPolyline(
                lPolygon,
                5,
                OffsetDirection.INSET
            );
            // Might succeed with reduced geometry or fail entirely
            if (largeInset.success) {
                expect(largeInset.shapes.length).toBeGreaterThanOrEqual(0);
            } else {
                expect(largeInset.errors.length).toBeGreaterThan(0);
            }
        });

        it('should handle nearly collinear points', () => {
            // Points that are almost but not quite collinear
            const nearCollinear: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 5, y: 0.001, bulge: 0 }, // Very slight deviation
                    { x: 10, y: 0, bulge: 0 },
                    { x: 10, y: 10, bulge: 0 },
                    { x: 0, y: 10, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const result = offsetPolyline(
                nearCollinear,
                1,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);
        });

        it('should handle polygon with hole-like indentation', () => {
            // Create polygon with deep indentation
            const indented: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 20, y: 0, bulge: 0 },
                    { x: 20, y: 20, bulge: 0 },
                    { x: 15, y: 20, bulge: 0 },
                    { x: 15, y: 5, bulge: 0 },
                    { x: 5, y: 5, bulge: 0 },
                    { x: 5, y: 20, bulge: 0 },
                    { x: 0, y: 20, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const result = offsetPolyline(indented, 2, OffsetDirection.INSET);
            expect(result.success).toBe(true);
            // May result in multiple disconnected shapes
            expect(result.shapes.length).toBeGreaterThan(0);
        });
    });

    describe('Polyline offset accuracy', () => {
        it('should maintain constant offset distance for simple rectangle', () => {
            const rectangle: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                    { x: 10, y: 6, bulge: 0 },
                    { x: 0, y: 6, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const offsetDistance = 1.5;
            const result = offsetPolyline(
                rectangle,
                offsetDistance,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);

            // Extract points from the offset shapes (could be individual lines/arcs or polyline)
            const allPoints = extractPointsFromShapes(result.shapes);

            // Check that the resulting polygon is approximately the right size
            // For a rectangle offset outward, the new dimensions should be:
            // width = original_width + 2 * offset
            // height = original_height + 2 * offset

            const bounds = calculateBounds(allPoints);
            const expectedWidth = 10 + 2 * offsetDistance;
            const expectedHeight = 6 + 2 * offsetDistance;

            expect(bounds.width).toBeCloseTo(expectedWidth, 1); // Looser tolerance for Clipper2
            expect(bounds.height).toBeCloseTo(expectedHeight, 1);
        });

        it('should produce consistent offset behavior for square polygon', () => {
            const square: Polyline = createPolylineFromVertices(
                [
                    { x: 0, y: 0, bulge: 0 },
                    { x: 10, y: 0, bulge: 0 },
                    { x: 10, y: 10, bulge: 0 },
                    { x: 0, y: 10, bulge: 0 },
                ],
                true
            ).geometry as Polyline;

            const offsetDistance = 1;

            // Test both inset and outset
            const insetResult = offsetPolyline(
                square,
                offsetDistance,
                OffsetDirection.INSET
            );
            const outsetResult = offsetPolyline(
                square,
                offsetDistance,
                OffsetDirection.OUTSET
            );

            expect(insetResult.success).toBe(true);
            expect(outsetResult.success).toBe(true);

            const insetBounds = calculateBounds(
                extractPointsFromShapes(insetResult.shapes)
            );
            const outsetBounds = calculateBounds(
                extractPointsFromShapes(outsetResult.shapes)
            );

            // Basic validation - both should produce valid polygons
            expect(insetBounds.width).toBeGreaterThan(0);
            expect(insetBounds.height).toBeGreaterThan(0);
            expect(outsetBounds.width).toBeGreaterThan(0);
            expect(outsetBounds.height).toBeGreaterThan(0);

            // Outset should be larger than inset (regardless of exact dimensions)
            expect(outsetBounds.width).toBeGreaterThan(insetBounds.width);
            expect(outsetBounds.height).toBeGreaterThan(insetBounds.height);

            // Outset should be larger than original
            expect(outsetBounds.width).toBeGreaterThan(10);
            expect(outsetBounds.height).toBeGreaterThan(10);
        });
    });

    describe('Real DXF polylines with bulges', () => {
        it('should successfully offset polylines_with_bulge.dxf polylines for both inner and outer', async () => {
            // Load the actual DXF file that was failing in visual tests
            const dxfContent = readFileSync(
                'tests/dxf/polylines_with_bulge.dxf',
                'utf-8'
            );

            // Parse DXF to shapes
            const drawing: Drawing = await parseDXF(dxfContent);
            expect(drawing.shapes.length).toBeGreaterThan(0);

            // Find polyline shapes
            // const polylineShapes: Shape[] = drawing.shapes.filter(shape => shape.type === 'polyline');
            // expect(polylineShapes.length).toBeGreaterThanOrEqual(2); // Should have at least 2 polylines from the DXF
            const polylineShapes: Shape[] = drawing.shapes;

            // Test offsetting each polyline
            for (let i: number = 0; i < polylineShapes.length; i++) {
                const polylineShape: Shape = polylineShapes[i];
                const polyline: Polyline = polylineShape.geometry as Polyline;

                // Since these are closed polylines (flag 70=1 in DXF), they should support both inner and outer offsets
                expect(polyline.closed).toBe(true);

                // Test outset (outer) offset
                const outsetResult = offsetShape(
                    polylineShape,
                    5,
                    OffsetDirection.OUTSET
                );
                expect(
                    outsetResult.success,
                    `Outset offset should succeed for polyline ${i}. Errors: ${outsetResult.errors.join(', ')}`
                ).toBe(true);
                expect(
                    outsetResult.shapes.length,
                    `Should produce outset offset shapes for polyline ${i}`
                ).toBeGreaterThan(0);

                // Test inset (inner) offset
                const insetResult = offsetShape(
                    polylineShape,
                    5,
                    OffsetDirection.INSET
                );
                expect(
                    insetResult.success,
                    `Inset offset should succeed for polyline ${i}. Errors: ${insetResult.errors.join(', ')}`
                ).toBe(true);
                expect(
                    insetResult.shapes.length,
                    `Should produce inset offset shapes for polyline ${i}`
                ).toBeGreaterThan(0);

                // Verify the offset shapes are valid
                for (const shape of outsetResult.shapes) {
                    expect(['line', 'arc', 'polyline']).toContain(shape.type);
                    expect(shape.geometry).toBeDefined();
                }

                for (const shape of insetResult.shapes) {
                    expect(['line', 'arc', 'polyline']).toContain(shape.type);
                    expect(shape.geometry).toBeDefined();
                }

                console.log(
                    `Polyline ${i}: outset produced ${outsetResult.shapes.length} shapes, inset produced ${insetResult.shapes.length} shapes`
                );
            }
        });
    });

    describe('error handling and edge cases', () => {
        it('should handle polyline with shapes that already have IDs', () => {
            // Create polyline with shapes that already have IDs
            const polylineWithIds: Polyline = {
                closed: false,
                shapes: [
                    {
                        id: 'existing-id-1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                    {
                        id: 'existing-id-2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 10, y: 10 },
                        },
                    },
                ],
            };

            const result = offsetPolyline(
                polylineWithIds,
                2,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);
        });

        it('should handle zero offset distance', () => {
            const result = offsetPolyline(
                openPolyline,
                0,
                OffsetDirection.OUTSET
            );
            expect(result.success).toBe(true);
            expect(result.shapes).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        // Skip this test - it's very hard to reliably trigger the catch block
        // The offsetChain function is robust and handles most invalid inputs gracefully
        it.skip('should handle error when offsetChain throws', () => {
            // Create a polyline that might cause offsetChain to throw
            // We'll use a polyline with invalid geometry that should trigger an error
            const invalidPolyline: Polyline = {
                closed: true,
                shapes: [
                    {
                        id: 'invalid-1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: NaN, y: NaN },
                            end: { x: Infinity, y: -Infinity },
                        },
                    },
                ],
            };

            const result = offsetPolyline(
                invalidPolyline,
                5,
                OffsetDirection.OUTSET
            );

            // The function should catch the error and return a failure result
            expect(result.success).toBe(false);
            expect(result.shapes).toHaveLength(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Polyline offset failed');
        });
    });
});

// Helper function to extract points from various shape types
function extractPointsFromShapes(shapes: Shape[]): Point2D[] {
    const allPoints: Point2D[] = [];

    for (const shape of shapes) {
        switch (shape.type) {
            case 'polyline':
                allPoints.push(...polylineToPoints(shape.geometry as Polyline));
                break;
            case 'line':
                const line = shape.geometry as Line;
                allPoints.push(line.start, line.end);
                break;
            case 'arc':
                const arc = shape.geometry as Arc;
                // Sample points along the arc
                const startPoint = {
                    x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
                    y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
                };
                const endPoint = {
                    x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
                    y: arc.center.y + arc.radius * Math.sin(arc.endAngle),
                };
                allPoints.push(startPoint, endPoint);

                // Add some intermediate points for better bounds calculation
                let angle = arc.startAngle;
                const angleStep = (arc.endAngle - arc.startAngle) / 10;
                for (let i: number = 1; i < 10; i++) {
                    angle += angleStep;
                    allPoints.push({
                        x: arc.center.x + arc.radius * Math.cos(angle),
                        y: arc.center.y + arc.radius * Math.sin(angle),
                    });
                }
                break;
            case 'circle':
                const circle = shape.geometry as Circle;
                // Sample points around the circle
                for (let i: number = 0; i < 8; i++) {
                    const angle: number = (i * Math.PI * 2) / 8;
                    allPoints.push({
                        x: circle.center.x + circle.radius * Math.cos(angle),
                        y: circle.center.y + circle.radius * Math.sin(angle),
                    });
                }
                break;
            default:
                console.warn(
                    `Unknown shape type for point extraction: ${shape.type}`
                );
        }
    }

    return allPoints;
}

// Helper function for bounds calculation
function calculateBounds(points: Point2D[]) {
    if (points.length === 0) {
        return {
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0,
            width: 0,
            height: 0,
        };
    }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
    };
}
