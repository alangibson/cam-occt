import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import verb from 'verb-nurbs';
import { beforeAll, describe, it } from 'vitest';
import { tessellateEllipse } from '../../../geometry/ellipse-tessellation';
import {
    createPolylineFromVertices,
    polylineToPoints,
} from '../../../geometry/polyline';
import { SVGBuilder } from '../../../test/svg-builder';
import {
    GeometryType,
    type Arc,
    type Circle,
    type Ellipse,
    type Line,
    type Polyline,
    type Shape,
    type Spline,
} from '../../../types/geometry';
import { offsetArc } from '../offset/arc/arc';
import { offsetEllipse } from '../offset/ellipse/ellipse';
import { offsetLine } from '../offset/line/line';
import { offsetPolyline } from '../offset/polyline/polyline';
import { offsetSpline, tessellateVerbCurve } from '../offset/spline/spline';
import { OffsetDirection } from '../offset/types';
import { createExtendedArc } from './arc';
import { createExtendedLine } from './line';
import { createExtendedPolyline } from './polyline';
import { createExtendedSplineVerb } from './spline';

describe('Shape Extension Visual Tests', { timeout: 60000 }, () => {
    const outputDir = 'tests/output/visual/extend';

    beforeAll(() => {
        try {
            mkdirSync(outputDir, { recursive: true });
        } catch {
            // Directory might already exist
        }
    });

    it('should generate SVG for line extensions', () => {
        // Single line example
        const testLine: Line = {
            start: { x: 100, y: 150 },
            end: { x: 300, y: 150 },
        };

        const svg = new SVGBuilder(500, 300);

        // Original line in black
        const originalLineShape: Shape = {
            id: 'original-line',
            type: GeometryType.LINE,
            geometry: testLine,
        };
        svg.addShape(originalLineShape, 'black', 3);

        // Create offsets
        const outsetResult = offsetLine(testLine, 20, OffsetDirection.OUTSET);
        const insetResult = offsetLine(testLine, 20, OffsetDirection.INSET);

        // Draw offset lines
        if (outsetResult.success) {
            const outsetGeometry = outsetResult.shapes[0].geometry as Line;
            const outsetLineShape: Shape = {
                id: 'outset-line',
                type: GeometryType.LINE,
                geometry: outsetGeometry,
            };
            svg.addShape(outsetLineShape, 'red', 2);

            // Add extensions to offset line
            svg.addLineExtensions(outsetGeometry, 'red', 1, 60);
        }

        if (insetResult.success) {
            const insetGeometry = insetResult.shapes[0].geometry as Line;
            const insetLineShape: Shape = {
                id: 'inset-line',
                type: GeometryType.LINE,
                geometry: insetGeometry,
            };
            svg.addShape(insetLineShape, 'blue', 2);

            // Add extensions to offset line
            svg.addLineExtensions(insetGeometry, 'blue', 1, 60);
        }

        // Add extensions to original line
        svg.addLineExtensions(testLine, 'gray', 1, 80);

        // Create extended line for demonstration
        const extendedLine = createExtendedLine(testLine, 40);
        // Draw extended parts in green dashed
        const startExtensionLine: Line = {
            start: testLine.start,
            end: extendedLine.start,
        };
        const startExtensionShape: Shape = {
            id: 'start-extension',
            type: GeometryType.LINE,
            geometry: startExtensionLine,
        };
        svg.addShape(startExtensionShape, 'green', 2, undefined, '5,5');

        const endExtensionLine: Line = {
            start: testLine.end,
            end: extendedLine.end,
        };
        const endExtensionShape: Shape = {
            id: 'end-extension',
            type: GeometryType.LINE,
            geometry: endExtensionLine,
        };
        svg.addShape(endExtensionShape, 'green', 2, undefined, '5,5');

        svg.addLegend([
            { color: 'black', label: 'Original Line' },
            { color: 'red', label: 'Outset (+20) & Extensions' },
            { color: 'blue', label: 'Inset (-20) & Extensions' },
            { color: 'gray', label: 'Original Extensions (dotted)' },
            { color: 'green', label: 'Extended Line (dashed)' },
        ]);

        writeFileSync(join(outputDir, 'line-extensions.svg'), svg.toString());
    });

    it('should generate SVG for arc extensions', () => {
        // Single arc example
        const testArc: Arc = {
            center: { x: 200, y: 150 },
            radius: 80,
            startAngle: Math.PI / 6,
            endAngle: (5 * Math.PI) / 6,
            clockwise: false,
        };

        const svg = new SVGBuilder(500, 300);

        // Original arc in black
        const originalArcShape: Shape = {
            id: 'original-arc',
            type: GeometryType.ARC,
            geometry: testArc,
        };
        svg.addShape(originalArcShape, 'black', 3);

        // Center point for reference
        const centerCircle: Circle = { center: testArc.center, radius: 3 };
        const centerCircleShape: Shape = {
            id: 'arc-center',
            type: GeometryType.CIRCLE,
            geometry: centerCircle,
        };
        svg.addShape(centerCircleShape, 'black', 1);

        // Create offsets
        const outsetResult = offsetArc(testArc, 20, OffsetDirection.OUTSET);
        const insetResult = offsetArc(testArc, 20, OffsetDirection.INSET);

        // Draw offset arcs
        if (outsetResult.success) {
            const outsetGeometry = outsetResult.shapes[0].geometry as Arc;
            const outsetArcShape: Shape = {
                id: 'outset-arc',
                type: GeometryType.ARC,
                geometry: outsetGeometry,
            };
            svg.addShape(outsetArcShape, 'red', 2);

            // Add extensions to offset arc
            svg.addArcExtensions(outsetGeometry, 'red', 1, 60);
        }

        if (insetResult.success) {
            const insetGeometry = insetResult.shapes[0].geometry as Arc;
            const insetArcShape: Shape = {
                id: 'inset-arc',
                type: GeometryType.ARC,
                geometry: insetGeometry,
            };
            svg.addShape(insetArcShape, 'blue', 2);

            // Add extensions to offset arc
            svg.addArcExtensions(insetGeometry, 'blue', 1, 60);
        }

        // Add extensions to original arc
        svg.addArcExtensions(testArc, 'gray', 1, 80);

        // Create extended arc for demonstration
        const extendedArc = createExtendedArc(testArc, Math.PI / 4); // Extend by 45 degrees
        // Draw extended parts in green dashed
        const originalStartExtended: Arc = {
            center: testArc.center,
            radius: testArc.radius,
            startAngle: extendedArc.startAngle,
            endAngle: testArc.startAngle,
            clockwise: testArc.clockwise,
        };
        const originalEndExtended: Arc = {
            center: testArc.center,
            radius: testArc.radius,
            startAngle: testArc.endAngle,
            endAngle: extendedArc.endAngle,
            clockwise: testArc.clockwise,
        };
        svg.addArcWithDash(originalStartExtended, 'green', 2, '5,5');
        svg.addArcWithDash(originalEndExtended, 'green', 2, '5,5');

        svg.addLegend([
            { color: 'black', label: 'Original Arc' },
            { color: 'red', label: 'Outset (+20) & Extensions' },
            { color: 'blue', label: 'Inset (-20) & Extensions' },
            { color: 'gray', label: 'Original Extensions (dotted)' },
            { color: 'green', label: 'Extended Arc (dashed)' },
        ]);

        writeFileSync(join(outputDir, 'arc-extensions.svg'), svg.toString());
    });

    it('should generate SVG for spline extensions', () => {
        const testSplines: Spline[] = [
            // Open C-shaped curve
            {
                controlPoints: [
                    { x: 50, y: 150 },
                    { x: 100, y: 50 },
                    { x: 200, y: 50 },
                    { x: 250, y: 150 },
                ],
                degree: 3,
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                closed: false,
                fitPoints: [],
            },
            // S-shaped curve
            {
                controlPoints: [
                    { x: 50, y: 300 },
                    { x: 150, y: 250 },
                    { x: 250, y: 350 },
                    { x: 350, y: 300 },
                ],
                degree: 3,
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                closed: false,
                fitPoints: [],
            },
        ];

        const svg = new SVGBuilder(450, 400);

        testSplines.forEach((spline, index) => {
            // Tessellate original spline for visualization
            try {
                const verbCurve =
                    verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                        spline.degree,
                        spline.knots,
                        spline.controlPoints.map((p) => [p.x, p.y, 0]),
                        spline.weights
                    );
                const points = tessellateVerbCurve(verbCurve);
                const polylineFromSpline: Polyline = {
                    shapes: points.slice(0, -1).map((p, i) => ({
                        id: `spline-seg-${index}-${i}`,
                        type: GeometryType.LINE,
                        geometry: { start: p, end: points[i + 1] } as Line,
                    })),
                    closed: spline.closed,
                };
                const splinePolylineShape: Shape = {
                    id: `spline-polyline-${index}`,
                    type: GeometryType.POLYLINE,
                    geometry: polylineFromSpline,
                };
                svg.addShape(splinePolylineShape, 'black', 2);
            } catch {
                // Fallback to control points
                const fallbackPolyline: Polyline = {
                    shapes: spline.controlPoints.slice(0, -1).map((p, i) => ({
                        id: `spline-fallback-seg-${index}-${i}`,
                        type: GeometryType.LINE,
                        geometry: {
                            start: p,
                            end: spline.controlPoints[i + 1],
                        } as Line,
                    })),
                    closed: spline.closed,
                };
                const fallbackShape: Shape = {
                    id: `spline-fallback-${index}`,
                    type: GeometryType.POLYLINE,
                    geometry: fallbackPolyline,
                };
                svg.addShape(fallbackShape, 'black', 2);
            }

            // Show control points
            spline.controlPoints.forEach((point, i) => {
                const controlPointCircle: Circle = { center: point, radius: 3 };
                const controlPointShape: Shape = {
                    id: `control-point-${index}-${i}`,
                    type: GeometryType.CIRCLE,
                    geometry: controlPointCircle,
                };
                svg.addShape(controlPointShape, 'purple', 1);
                svg.addText(point.x + 5, point.y - 5, `C${i}`, 'purple', '8px');
            });

            // Create offsets
            const outsetResult = offsetSpline(
                spline,
                20,
                OffsetDirection.OUTSET,
                0.5,
                3
            );
            const insetResult = offsetSpline(
                spline,
                20,
                OffsetDirection.INSET,
                0.5,
                3
            );

            // Draw offset splines
            if (outsetResult.success && outsetResult.shapes.length > 0) {
                const outsetGeometry = outsetResult.shapes[0]
                    .geometry as Spline;
                try {
                    const verbCurve =
                        verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                            outsetGeometry.degree,
                            outsetGeometry.knots,
                            outsetGeometry.controlPoints.map((p) => [
                                p.x,
                                p.y,
                                0,
                            ]),
                            outsetGeometry.weights
                        );
                    const points = tessellateVerbCurve(verbCurve);
                    const outsetPolyline: Polyline = {
                        shapes: points.slice(0, -1).map((p, i) => ({
                            id: `outset-spline-seg-${index}-${i}`,
                            type: GeometryType.LINE,
                            geometry: { start: p, end: points[i + 1] } as Line,
                        })),
                        closed: outsetGeometry.closed,
                    };
                    const outsetPolylineShape: Shape = {
                        id: `outset-spline-polyline-${index}`,
                        type: GeometryType.POLYLINE,
                        geometry: outsetPolyline,
                    };
                    svg.addShape(outsetPolylineShape, 'red', 2);
                } catch {
                    const outsetFallbackPolyline: Polyline = {
                        shapes: outsetGeometry.controlPoints
                            .slice(0, -1)
                            .map((p, i) => ({
                                id: `outset-fallback-seg-${index}-${i}`,
                                type: GeometryType.LINE,
                                geometry: {
                                    start: p,
                                    end: outsetGeometry.controlPoints[i + 1],
                                } as Line,
                            })),
                        closed: outsetGeometry.closed,
                    };
                    const outsetFallbackShape: Shape = {
                        id: `outset-fallback-${index}`,
                        type: GeometryType.POLYLINE,
                        geometry: outsetFallbackPolyline,
                    };
                    svg.addShape(outsetFallbackShape, 'red', 2);
                }

                // Add extensions to offset spline
                svg.addSplineExtensions(outsetGeometry, 'red', 1, 50);
            }

            if (insetResult.success && insetResult.shapes.length > 0) {
                const insetGeometry = insetResult.shapes[0].geometry as Spline;
                try {
                    const verbCurve =
                        verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                            insetGeometry.degree,
                            insetGeometry.knots,
                            insetGeometry.controlPoints.map((p) => [
                                p.x,
                                p.y,
                                0,
                            ]),
                            insetGeometry.weights
                        );
                    const points = tessellateVerbCurve(verbCurve);
                    const insetPolyline: Polyline = {
                        shapes: points.slice(0, -1).map((p, i) => ({
                            id: `inset-spline-seg-${index}-${i}`,
                            type: GeometryType.LINE,
                            geometry: { start: p, end: points[i + 1] } as Line,
                        })),
                        closed: insetGeometry.closed,
                    };
                    const insetPolylineShape: Shape = {
                        id: `inset-spline-polyline-${index}`,
                        type: GeometryType.POLYLINE,
                        geometry: insetPolyline,
                    };
                    svg.addShape(insetPolylineShape, 'blue', 2);
                } catch {
                    const insetFallbackPolyline: Polyline = {
                        shapes: insetGeometry.controlPoints
                            .slice(0, -1)
                            .map((p, i) => ({
                                id: `inset-fallback-seg-${index}-${i}`,
                                type: GeometryType.LINE,
                                geometry: {
                                    start: p,
                                    end: insetGeometry.controlPoints[i + 1],
                                } as Line,
                            })),
                        closed: insetGeometry.closed,
                    };
                    const insetFallbackShape: Shape = {
                        id: `inset-fallback-${index}`,
                        type: GeometryType.POLYLINE,
                        geometry: insetFallbackPolyline,
                    };
                    svg.addShape(insetFallbackShape, 'blue', 2);
                }

                // Add extensions to offset spline
                svg.addSplineExtensions(insetGeometry, 'blue', 1, 50);
            }

            // Add tangent extensions
            svg.addSplineExtensions(spline, 'gray', 1, 60);

            // Create extended spline for demonstration
            try {
                const extendedSpline = createExtendedSplineVerb(
                    spline,
                    true,
                    true,
                    0.2
                );
                const verbCurve =
                    verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                        extendedSpline.degree(),
                        extendedSpline.knots(),
                        extendedSpline
                            .controlPoints()
                            .map((p) => [p[0], p[1], 0]),
                        extendedSpline.weights()
                    );
                const points = tessellateVerbCurve(verbCurve);
                const extendedPolyline: Polyline = {
                    shapes: points.slice(0, -1).map((p, i) => ({
                        id: `extended-spline-seg-${index}-${i}`,
                        type: GeometryType.LINE,
                        geometry: { start: p, end: points[i + 1] } as Line,
                    })),
                    closed: spline.closed,
                };
                const extendedPolylineShape: Shape = {
                    id: `extended-spline-${index}`,
                    type: GeometryType.POLYLINE,
                    geometry: extendedPolyline,
                };
                svg.addShape(extendedPolylineShape, 'green', 1);
            } catch {
                // Extension failed, skip green line
            }
        });

        svg.addLegend([
            { color: 'black', label: 'Original Splines' },
            { color: 'purple', label: 'Control Points' },
            { color: 'red', label: 'Outset (+20) & Extensions' },
            { color: 'blue', label: 'Inset (-20) & Extensions' },
            { color: 'gray', label: 'Original Extensions (dotted)' },
            { color: 'green', label: 'Extended Splines' },
        ]);

        writeFileSync(join(outputDir, 'spline-extensions.svg'), svg.toString());
    });

    it('should generate SVG for polyline extensions', () => {
        const testPolylines: Polyline[] = [
            // Open L-shape
            createPolylineFromVertices(
                [
                    { x: 50, y: 50, bulge: 0 },
                    { x: 150, y: 50, bulge: 0 },
                    { x: 150, y: 150, bulge: 0 },
                ],
                false
            ).geometry as Polyline,
            // Open zigzag
            createPolylineFromVertices(
                [
                    { x: 200, y: 80, bulge: 0 },
                    { x: 250, y: 40, bulge: 0 },
                    { x: 300, y: 80, bulge: 0 },
                    { x: 350, y: 40, bulge: 0 },
                ],
                false
            ).geometry as Polyline,
            // Closed triangle (for comparison)
            createPolylineFromVertices(
                [
                    { x: 100, y: 200, bulge: 0 },
                    { x: 200, y: 200, bulge: 0 },
                    { x: 150, y: 280, bulge: 0 },
                ],
                true
            ).geometry as Polyline,
            // Open stepped path
            createPolylineFromVertices(
                [
                    { x: 250, y: 200, bulge: 0 },
                    { x: 280, y: 200, bulge: 0 },
                    { x: 280, y: 230, bulge: 0 },
                    { x: 310, y: 230, bulge: 0 },
                    { x: 310, y: 260, bulge: 0 },
                ],
                false
            ).geometry as Polyline,
        ];

        const svg = new SVGBuilder(450, 350);

        testPolylines.forEach((polyline, index) => {
            // Original polyline in black
            const originalPolylineShape: Shape = {
                id: `original-polyline-${index}`,
                type: GeometryType.POLYLINE,
                geometry: polyline,
            };
            svg.addShape(originalPolylineShape, 'black', 2);

            // Show vertices
            polylineToPoints(polyline).forEach((point, i) => {
                const vertexCircle: Circle = { center: point, radius: 2 };
                const vertexShape: Shape = {
                    id: `vertex-${index}-${i}`,
                    type: GeometryType.CIRCLE,
                    geometry: vertexCircle,
                };
                svg.addShape(vertexShape, 'black', 1);
            });

            // Create offsets
            const outsetResult = offsetPolyline(
                polyline,
                12,
                OffsetDirection.OUTSET
            );
            const insetResult = offsetPolyline(
                polyline,
                12,
                OffsetDirection.INSET
            );

            // Draw offset polylines
            if (outsetResult.success && outsetResult.shapes.length > 0) {
                outsetResult.shapes.forEach((shape) => {
                    const polylineGeometry = shape.geometry as Polyline;
                    const outsetPolylineShape: Shape = {
                        id: `outset-polyline-${index}`,
                        type: GeometryType.POLYLINE,
                        geometry: polylineGeometry,
                    };
                    svg.addShape(outsetPolylineShape, 'red', 2);

                    // Add extensions to offset polyline (only for open polylines)
                    if (!polylineGeometry.closed) {
                        svg.addPolylineExtensions(
                            polylineGeometry,
                            'red',
                            1,
                            40
                        );
                    }
                });
            }

            if (insetResult.success && insetResult.shapes.length > 0) {
                insetResult.shapes.forEach((shape) => {
                    const polylineGeometry = shape.geometry as Polyline;
                    const insetPolylineShape: Shape = {
                        id: `inset-polyline-${index}`,
                        type: GeometryType.POLYLINE,
                        geometry: polylineGeometry,
                    };
                    svg.addShape(insetPolylineShape, 'blue', 2);

                    // Add extensions to offset polyline (only for open polylines)
                    if (!polylineGeometry.closed) {
                        svg.addPolylineExtensions(
                            polylineGeometry,
                            'blue',
                            1,
                            40
                        );
                    }
                });
            }

            // Add extensions (only for open polylines)
            if (!polyline.closed) {
                svg.addPolylineExtensions(polyline, 'gray', 1, 50);

                // Create extended polyline for demonstration
                const extendedPolyline = createExtendedPolyline(
                    polyline,
                    true,
                    true,
                    25
                );

                // Draw extensions in green dashed
                const extendedPoints = polylineToPoints(extendedPolyline);
                const originalPoints = polylineToPoints(polyline);
                if (extendedPoints.length > originalPoints.length) {
                    // Draw start extension
                    const startExtLine: Line = {
                        start: extendedPoints[0],
                        end: originalPoints[0],
                    };
                    const startExtShape: Shape = {
                        id: `polyline-start-ext-${index}`,
                        type: GeometryType.LINE,
                        geometry: startExtLine,
                    };
                    svg.addShape(startExtShape, 'green', 1, undefined, '3,3');

                    // Draw end extension
                    const originalEnd =
                        originalPoints[originalPoints.length - 1];
                    const extendedEnd =
                        extendedPoints[extendedPoints.length - 1];
                    const endExtLine: Line = {
                        start: originalEnd,
                        end: extendedEnd,
                    };
                    const endExtShape: Shape = {
                        id: `polyline-end-ext-${index}`,
                        type: GeometryType.LINE,
                        geometry: endExtLine,
                    };
                    svg.addShape(endExtShape, 'green', 1, undefined, '3,3');
                }
            }

            // Add label
            const firstPoint = polylineToPoints(polyline)[0];
            const labelText = polyline.closed ? 'Closed' : 'Open';
            svg.addText(
                firstPoint.x,
                firstPoint.y - 15,
                labelText,
                'black',
                '10px'
            );
        });

        svg.addLegend([
            { color: 'black', label: 'Original Polylines' },
            { color: 'red', label: 'Outset (+12) & Extensions' },
            { color: 'blue', label: 'Inset (-12) & Extensions' },
            { color: 'gray', label: 'Original Extensions (dotted)' },
            { color: 'green', label: 'Extended Polylines (dashed)' },
        ]);

        writeFileSync(
            join(outputDir, 'polyline-extensions.svg'),
            svg.toString()
        );
    });

    it('should generate SVG for ellipse arc extensions', () => {
        const testEllipseArcs: Ellipse[] = [
            // Quarter arc - horizontal major axis
            {
                center: { x: 120, y: 120 },
                majorAxisEndpoint: { x: 80, y: 0 },
                minorToMajorRatio: 0.6,
                startParam: 0,
                endParam: Math.PI / 2,
            },
            // Semi arc - vertical major axis
            {
                center: { x: 320, y: 120 },
                majorAxisEndpoint: { x: 0, y: 60 },
                minorToMajorRatio: 0.8,
                startParam: 0,
                endParam: Math.PI,
            },
            // 3/4 arc - tilted major axis
            {
                center: { x: 220, y: 300 },
                majorAxisEndpoint: { x: 60, y: 30 },
                minorToMajorRatio: 0.7,
                startParam: Math.PI / 4,
                endParam: 2 * Math.PI - Math.PI / 4,
            },
            // Small arc segment
            {
                center: { x: 400, y: 280 },
                majorAxisEndpoint: { x: 50, y: -20 },
                minorToMajorRatio: 0.5,
                startParam: Math.PI / 3,
                endParam: (2 * Math.PI) / 3,
            },
        ];

        const svg = new SVGBuilder(500, 420);

        testEllipseArcs.forEach((ellipseArc, index) => {
            // Generate points for the ellipse arc
            const arcPoints = tessellateEllipse(ellipseArc, { numPoints: 32 });
            const ellipsePolyline: Polyline = {
                shapes: arcPoints.slice(0, -1).map((p, i) => ({
                    id: `ellipse-arc-seg-${index}-${i}`,
                    type: GeometryType.LINE,
                    geometry: { start: p, end: arcPoints[i + 1] } as Line,
                })),
                closed: false,
            };
            const ellipsePolylineShape: Shape = {
                id: `ellipse-arc-${index}`,
                type: GeometryType.POLYLINE,
                geometry: ellipsePolyline,
            };
            svg.addShape(ellipsePolylineShape, 'black', 2);

            // Center point and major axis for reference
            const centerCircle: Circle = {
                center: ellipseArc.center,
                radius: 2,
            };
            const centerShape: Shape = {
                id: `ellipse-center-${index}`,
                type: GeometryType.CIRCLE,
                geometry: centerCircle,
            };
            svg.addShape(centerShape, 'black', 1);

            const majorEnd = {
                x: ellipseArc.center.x + ellipseArc.majorAxisEndpoint.x,
                y: ellipseArc.center.y + ellipseArc.majorAxisEndpoint.y,
            };
            const majorAxisLine: Line = {
                start: ellipseArc.center,
                end: majorEnd,
            };
            const majorAxisShape: Shape = {
                id: `major-axis-${index}`,
                type: GeometryType.LINE,
                geometry: majorAxisLine,
            };
            svg.addShape(majorAxisShape, 'purple', 1, undefined, '2,2');

            // Mark start and end points
            if (arcPoints.length > 0) {
                const startCircle: Circle = { center: arcPoints[0], radius: 3 };
                const startShape: Shape = {
                    id: `ellipse-start-${index}`,
                    type: GeometryType.CIRCLE,
                    geometry: startCircle,
                };
                svg.addShape(startShape, 'green', 1);

                const endCircle: Circle = {
                    center: arcPoints[arcPoints.length - 1],
                    radius: 3,
                };
                const endShape: Shape = {
                    id: `ellipse-end-${index}`,
                    type: GeometryType.CIRCLE,
                    geometry: endCircle,
                };
                svg.addShape(endShape, 'orange', 1);
            }

            // Calculate and show extensions
            if (arcPoints.length >= 2) {
                // Calculate tangent directions at start and end
                const startTangent = {
                    x: arcPoints[1].x - arcPoints[0].x,
                    y: arcPoints[1].y - arcPoints[0].y,
                };
                const endTangent = {
                    x:
                        arcPoints[arcPoints.length - 1].x -
                        arcPoints[arcPoints.length - 2].x,
                    y:
                        arcPoints[arcPoints.length - 1].y -
                        arcPoints[arcPoints.length - 2].y,
                };

                const startLen = Math.sqrt(
                    startTangent.x * startTangent.x +
                        startTangent.y * startTangent.y
                );
                const endLen = Math.sqrt(
                    endTangent.x * endTangent.x + endTangent.y * endTangent.y
                );

                if (startLen > 0 && endLen > 0) {
                    const extensionLength = 50;

                    const startExt = {
                        x:
                            arcPoints[0].x -
                            (startTangent.x / startLen) * extensionLength,
                        y:
                            arcPoints[0].y -
                            (startTangent.y / startLen) * extensionLength,
                    };
                    const endExt = {
                        x:
                            arcPoints[arcPoints.length - 1].x +
                            (endTangent.x / endLen) * extensionLength,
                        y:
                            arcPoints[arcPoints.length - 1].y +
                            (endTangent.y / endLen) * extensionLength,
                    };

                    // Draw tangent extensions
                    const startExtLine: Line = {
                        start: startExt,
                        end: arcPoints[0],
                    };
                    const startExtShape: Shape = {
                        id: `ellipse-start-ext-${index}`,
                        type: GeometryType.LINE,
                        geometry: startExtLine,
                    };
                    svg.addShape(startExtShape, 'gray', 1, undefined, '5,5');

                    const endExtLine: Line = {
                        start: arcPoints[arcPoints.length - 1],
                        end: endExt,
                    };
                    const endExtShape: Shape = {
                        id: `ellipse-end-ext-${index}`,
                        type: GeometryType.LINE,
                        geometry: endExtLine,
                    };
                    svg.addShape(endExtShape, 'gray', 1, undefined, '5,5');

                    // Show extended arc using elliptical arc extension
                    try {
                        const extendedEllipse: Ellipse = {
                            center: ellipseArc.center,
                            majorAxisEndpoint: ellipseArc.majorAxisEndpoint,
                            minorToMajorRatio: ellipseArc.minorToMajorRatio,
                            startParam: ellipseArc.startParam! - 0.3,
                            endParam: ellipseArc.endParam! + 0.3,
                        };
                        const extendedPoints = tessellateEllipse(
                            extendedEllipse,
                            {
                                numPoints: 40,
                            }
                        );

                        // Draw extended portions in green dashed
                        const originalStartIdx = Math.round(
                            (0.3 * 40) / (2 * Math.PI)
                        );
                        const originalEndIdx =
                            extendedPoints.length - originalStartIdx;

                        if (originalStartIdx > 0) {
                            const startExtPoints = extendedPoints.slice(
                                0,
                                originalStartIdx
                            );
                            const startExtPolyline: Polyline = {
                                shapes: startExtPoints
                                    .slice(0, -1)
                                    .map((p, i) => ({
                                        id: `ellipse-ext-start-seg-${index}-${i}`,
                                        type: GeometryType.LINE,
                                        geometry: {
                                            start: p,
                                            end: startExtPoints[i + 1],
                                        } as Line,
                                    })),
                                closed: false,
                            };
                            const startExtPolyShape: Shape = {
                                id: `ellipse-ext-start-${index}`,
                                type: GeometryType.POLYLINE,
                                geometry: startExtPolyline,
                            };
                            svg.addShape(startExtPolyShape, 'green', 1);
                        }
                        if (originalEndIdx < extendedPoints.length) {
                            const endExtPoints =
                                extendedPoints.slice(originalEndIdx);
                            const endExtPolyline: Polyline = {
                                shapes: endExtPoints
                                    .slice(0, -1)
                                    .map((p, i) => ({
                                        id: `ellipse-ext-end-seg-${index}-${i}`,
                                        type: GeometryType.LINE,
                                        geometry: {
                                            start: p,
                                            end: endExtPoints[i + 1],
                                        } as Line,
                                    })),
                                closed: false,
                            };
                            const endExtPolyShape: Shape = {
                                id: `ellipse-ext-end-${index}`,
                                type: GeometryType.POLYLINE,
                                geometry: endExtPolyline,
                            };
                            svg.addShape(endExtPolyShape, 'green', 1);
                        }
                    } catch {
                        // Extension failed, use simple line extensions
                    }
                }
            }

            // Create both outset and inset offsets to show relationship with extensions
            const outsetResult = offsetEllipse(
                ellipseArc,
                12,
                OffsetDirection.OUTSET
            );
            const insetResult = offsetEllipse(
                ellipseArc,
                12,
                OffsetDirection.INSET
            );

            // Draw outset offset
            if (outsetResult.success && outsetResult.shapes.length > 0) {
                const offsetShape = outsetResult.shapes[0];
                if (offsetShape.type === 'spline') {
                    const splineGeometry = offsetShape.geometry as Spline;
                    try {
                        const verbCurve =
                            verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                                splineGeometry.degree,
                                splineGeometry.knots,
                                splineGeometry.controlPoints.map((p) => [
                                    p.x,
                                    p.y,
                                    0,
                                ]),
                                splineGeometry.weights
                            );
                        const offsetPoints = tessellateVerbCurve(verbCurve);
                        const offsetPolyline: Polyline = {
                            shapes: offsetPoints.slice(0, -1).map((p, i) => ({
                                id: `ellipse-outset-seg-${index}-${i}`,
                                type: GeometryType.LINE,
                                geometry: {
                                    start: p,
                                    end: offsetPoints[i + 1],
                                } as Line,
                            })),
                            closed: splineGeometry.closed,
                        };
                        const offsetPolyShape: Shape = {
                            id: `ellipse-outset-${index}`,
                            type: GeometryType.POLYLINE,
                            geometry: offsetPolyline,
                        };
                        svg.addShape(offsetPolyShape, 'red', 1);

                        // Add extensions to outset offset spline
                        svg.addSplineExtensions(splineGeometry, 'red', 1, 40);
                    } catch {
                        const fallbackPolyline: Polyline = {
                            shapes: splineGeometry.controlPoints
                                .slice(0, -1)
                                .map((p, i) => ({
                                    id: `ellipse-outset-fallback-seg-${index}-${i}`,
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: p,
                                        end: splineGeometry.controlPoints[
                                            i + 1
                                        ],
                                    } as Line,
                                })),
                            closed: splineGeometry.closed,
                        };
                        const fallbackShape: Shape = {
                            id: `ellipse-outset-fallback-${index}`,
                            type: GeometryType.POLYLINE,
                            geometry: fallbackPolyline,
                        };
                        svg.addShape(fallbackShape, 'red', 1);
                    }
                }
            }

            // Draw inset offset
            if (insetResult.success && insetResult.shapes.length > 0) {
                const offsetShape = insetResult.shapes[0];
                if (offsetShape.type === 'spline') {
                    const splineGeometry = offsetShape.geometry as Spline;
                    try {
                        const verbCurve =
                            verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                                splineGeometry.degree,
                                splineGeometry.knots,
                                splineGeometry.controlPoints.map((p) => [
                                    p.x,
                                    p.y,
                                    0,
                                ]),
                                splineGeometry.weights
                            );
                        const offsetPoints = tessellateVerbCurve(verbCurve);
                        const insetPolyline: Polyline = {
                            shapes: offsetPoints.slice(0, -1).map((p, i) => ({
                                id: `ellipse-inset-seg-${index}-${i}`,
                                type: GeometryType.LINE,
                                geometry: {
                                    start: p,
                                    end: offsetPoints[i + 1],
                                } as Line,
                            })),
                            closed: splineGeometry.closed,
                        };
                        const insetPolyShape: Shape = {
                            id: `ellipse-inset-${index}`,
                            type: GeometryType.POLYLINE,
                            geometry: insetPolyline,
                        };
                        svg.addShape(insetPolyShape, 'blue', 1);

                        // Add extensions to inset offset spline
                        svg.addSplineExtensions(splineGeometry, 'blue', 1, 40);
                    } catch {
                        const insetFallbackPolyline: Polyline = {
                            shapes: splineGeometry.controlPoints
                                .slice(0, -1)
                                .map((p, i) => ({
                                    id: `ellipse-inset-fallback-seg-${index}-${i}`,
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: p,
                                        end: splineGeometry.controlPoints[
                                            i + 1
                                        ],
                                    } as Line,
                                })),
                            closed: splineGeometry.closed,
                        };
                        const insetFallbackShape: Shape = {
                            id: `ellipse-inset-fallback-${index}`,
                            type: GeometryType.POLYLINE,
                            geometry: insetFallbackPolyline,
                        };
                        svg.addShape(insetFallbackShape, 'blue', 1);
                    }
                }
            }

            // Add parameter range label
            const paramRange = (
                ((ellipseArc.endParam! - ellipseArc.startParam!) * 180) /
                Math.PI
            ).toFixed(0);
            svg.addText(
                ellipseArc.center.x,
                ellipseArc.center.y + 80,
                `Arc ${index + 1}: ${paramRange}°`,
                'black',
                '10px'
            );
        });

        svg.addLegend([
            { color: 'black', label: 'Original Ellipse Arcs' },
            { color: 'purple', label: 'Major Axis (dashed)' },
            { color: 'green', label: 'Start Point' },
            { color: 'orange', label: 'End Point' },
            { color: 'red', label: 'Outset (+12) & Extensions' },
            { color: 'blue', label: 'Inset (-12) & Extensions' },
            { color: 'gray', label: 'Tangent Extensions (dotted)' },
            { color: 'green', label: 'Extended Arc Portions' },
        ]);

        writeFileSync(
            join(outputDir, 'ellipse-arc-extensions.svg'),
            svg.toString()
        );
    });
});
