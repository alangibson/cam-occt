import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import verb from 'verb-nurbs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tessellateEllipse } from '$lib/geometry/ellipse/functions';
import {
    createPolylineFromVertices,
    polylineToPoints,
} from '$lib/geometry/polyline/functions';
import { SVGBuilder } from '$lib/test/svg-builder';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { offsetChain } from '$lib/algorithms/offset-calculation/chain/offset';
import type { ChainOffsetResult } from '$lib/algorithms/offset-calculation/chain/types';
import { DEFAULT_CHAIN_OFFSET_PARAMETERS } from '$lib/algorithms/offset-calculation/chain/types';
import { offsetArc } from './arc/arc';
import { offsetCircle } from './circle/circle';
import { offsetEllipse } from './ellipse/ellipse';
import { offsetLine } from './line/line';
import { offsetPolyline } from './polyline/polyline';
import { offsetSpline, tessellateVerbCurve } from './spline/spline';
import { OffsetDirection } from './types';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { calculateSignedArea } from '$lib/geometry/chain/functions';
import { GeometryType } from '$lib/geometry/shape/enums';

// Type guard function to check if a shape has polyline geometry
function isPolylineShape(
    shape: Shape
): shape is Shape & { geometry: Polyline } {
    return shape.type === 'polyline';
}

describe('Minimal Visual Validation Test', { timeout: 60000 }, () => {
    const outputDir = 'test-output/minimal-validation';

    beforeAll(() => {
        try {
            mkdirSync(outputDir, { recursive: true });
        } catch {
            // Directory might already exist
        }
    });

    it('should run first 3 visual tests without hanging', () => {
        // Test 1: Lines
        const testLines: Line[] = [
            { start: { x: 50, y: 200 }, end: { x: 350, y: 200 } },
            { start: { x: 200, y: 50 }, end: { x: 200, y: 350 } },
        ];

        const svg1 = createSVG(400, 300);
        testLines.forEach((line, index) => {
            const lineShape: Shape = {
                id: `test-line-${index}`,
                type: GeometryType.LINE,
                geometry: line,
            };
            svg1.addShape(lineShape, 'black', 1);
            const result = offsetLine(line, 20, OffsetDirection.OUTSET);
            if (result.success) {
                const geom = result.shapes[0].geometry as Line;
                const offsetShape: Shape = {
                    id: `offset-line-${index}`,
                    type: GeometryType.LINE,
                    geometry: geom,
                };
                svg1.addShape(offsetShape, 'red', 1);
            }
        });
        writeFileSync(join(outputDir, 'lines.svg'), svg1.toString());

        // Test 2: Circles
        const testCircles: Circle[] = [
            { center: { x: 120, y: 120 }, radius: 60 },
            { center: { x: 280, y: 120 }, radius: 40 },
        ];

        const svg2 = createSVG(400, 300);
        testCircles.forEach((circle, index) => {
            const circleShape: Shape = {
                id: `test-circle-${index}`,
                type: GeometryType.CIRCLE,
                geometry: circle,
            };
            svg2.addShape(circleShape, 'black', 1);
            const result = offsetCircle(circle, 10, OffsetDirection.OUTSET);
            if (result.success) {
                const geom = result.shapes[0].geometry as Circle;
                const offsetShape: Shape = {
                    id: `offset-circle-${index}`,
                    type: GeometryType.CIRCLE,
                    geometry: geom,
                };
                svg2.addShape(offsetShape, 'red', 1);
            }
        });
        writeFileSync(join(outputDir, 'circles.svg'), svg2.toString());

        // Test 3: Arcs
        const testArcs = [
            {
                center: { x: 120, y: 120 },
                radius: 60,
                startAngle: 0,
                endAngle: Math.PI,
                clockwise: false,
            },
        ];

        const svg3 = createSVG(400, 300);
        testArcs.forEach((arc, index) => {
            const arcShape: Shape = {
                id: `test-arc-${index}`,
                type: GeometryType.ARC,
                geometry: arc,
            };
            svg3.addShape(arcShape, 'black', 2);
            const result = offsetArc(arc, 15, OffsetDirection.OUTSET);
            if (result.success) {
                const geom = result.shapes[0].geometry as Arc;
                const offsetShape: Shape = {
                    id: `offset-arc-${index}`,
                    type: GeometryType.ARC,
                    geometry: geom,
                };
                svg3.addShape(offsetShape, 'red', 1);
            }
        });
        writeFileSync(join(outputDir, 'arcs.svg'), svg3.toString());

        expect(true).toBe(true);
    });

    function createSVG(width: number, height: number) {
        return new SVGBuilder(width, height);
    }
});

describe(
    'Visual Validation - SVG Output Generator',
    { timeout: 120000 },
    () => {
        const outputDir = 'tests/output/visual/offsets';

        // Create output directory
        beforeAll(() => {
            try {
                mkdirSync(outputDir, { recursive: true });
            } catch {
                // Directory might already exist
            }
        });

        // Clean up verb-nurbs resources
        afterAll(() => {
            // Force garbage collection to clean up verb-nurbs native resources
            if (global.gc) {
                global.gc();
            }
            // Give time for cleanup
            return new Promise((resolve) => setTimeout(resolve, 100));
        });

        describe('Line offset visualization', () => {
            it('should generate SVG for horizontal line offsets', () => {
                const testLines: Line[] = [
                    { start: { x: 50, y: 200 }, end: { x: 350, y: 200 } }, // Horizontal
                    { start: { x: 200, y: 50 }, end: { x: 200, y: 350 } }, // Vertical
                    { start: { x: 80, y: 80 }, end: { x: 320, y: 320 } }, // Diagonal
                ];

                const svg = createSVG(400, 450);

                testLines.forEach((line, index) => {
                    // Original line in black
                    const originalShape: Shape = {
                        id: `line-${index}`,
                        type: GeometryType.LINE,
                        geometry: line,
                    };
                    svg.addShape(originalShape, 'black', 1);

                    // Offset lines in red (outset) and blue (inset)
                    const outsetResult = offsetLine(
                        line,
                        20,
                        OffsetDirection.OUTSET
                    );
                    const insetResult = offsetLine(
                        line,
                        20,
                        OffsetDirection.INSET
                    );

                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Line;
                        const outsetShape: Shape = {
                            id: `line-outset-${index}`,
                            type: GeometryType.LINE,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Line;
                        const insetShape: Shape = {
                            id: `line-inset-${index}`,
                            type: GeometryType.LINE,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+20)' },
                    { color: 'blue', label: 'Inset (-20)' },
                ]);

                writeFileSync(
                    join(outputDir, 'line-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true); // Test passes if no errors
            });
        });

        describe('Circle offset visualization', () => {
            it('should generate SVG for circle offsets', () => {
                const testCircles: Circle[] = [
                    { center: { x: 120, y: 120 }, radius: 60 },
                    { center: { x: 280, y: 120 }, radius: 40 },
                    { center: { x: 200, y: 280 }, radius: 80 },
                ];

                const svg = createSVG(400, 450);

                testCircles.forEach((circle, index) => {
                    // Original circle in black
                    const originalShape: Shape = {
                        id: `circle-${index}`,
                        type: GeometryType.CIRCLE,
                        geometry: circle,
                    };
                    svg.addShape(originalShape, 'black', 1);

                    // Offset circles
                    const outsetResult = offsetCircle(
                        circle,
                        3,
                        OffsetDirection.OUTSET
                    );
                    const insetResult = offsetCircle(
                        circle,
                        3,
                        OffsetDirection.INSET
                    );

                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Circle;
                        const outsetShape: Shape = {
                            id: `circle-outset-${index}`,
                            type: GeometryType.CIRCLE,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Circle;
                        const insetShape: Shape = {
                            id: `circle-inset-${index}`,
                            type: GeometryType.CIRCLE,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+3)' },
                    { color: 'blue', label: 'Inset (-3)' },
                ]);

                writeFileSync(
                    join(outputDir, 'circle-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });
        });

        describe('Arc offset visualization', () => {
            it('should generate SVG for arc offsets with multiple sweep angles', () => {
                const testArcs = [
                    {
                        name: '120° arc',
                        arc: {
                            center: { x: 120, y: 80 },
                            radius: 60,
                            startAngle: (-60 * Math.PI) / 180, // -60° to +60° = 120° sweep
                            endAngle: (60 * Math.PI) / 180,
                            clockwise: false,
                        },
                        labelPos: { x: 120, y: 50 },
                    },
                    {
                        name: '180° arc',
                        arc: {
                            center: { x: 280, y: 80 },
                            radius: 60,
                            startAngle: 0, // 0° to 180° = 180° sweep
                            endAngle: Math.PI,
                            clockwise: false,
                        },
                        labelPos: { x: 280, y: 50 },
                    },
                    {
                        name: '270° arc',
                        arc: {
                            center: { x: 120, y: 220 },
                            radius: 60,
                            startAngle: 0, // 0° to 270° = 270° sweep
                            endAngle: (3 * Math.PI) / 2,
                            clockwise: false,
                        },
                        labelPos: { x: 120, y: 190 },
                    },
                    {
                        name: 'Open Chain Arc',
                        arc: {
                            center: { x: 280, y: 220 },
                            radius: 30,
                            startAngle: Math.PI / 2, // 90° to 0° = 90° sweep
                            endAngle: 0,
                            clockwise: false,
                        },
                        labelPos: { x: 280, y: 190 },
                    },
                ];

                const svg = createSVG(450, 340);

                testArcs.forEach((testCase, index) => {
                    const { arc, labelPos, name } = testCase;

                    // Add center point for reference
                    const centerCircle: Circle = {
                        center: arc.center,
                        radius: 2,
                    };
                    const centerShape: Shape = {
                        id: `arc-center-${index}`,
                        type: GeometryType.CIRCLE,
                        geometry: centerCircle,
                    };
                    svg.addShape(centerShape, '#888', 1);

                    // Original arc in black (consistent with other tests)
                    const arcShape: Shape = {
                        id: `arc-${index}`,
                        type: GeometryType.ARC,
                        geometry: arc,
                    };
                    svg.addShape(arcShape, 'black', 2);
                    svg.addText(labelPos.x, labelPos.y, name, 'black', '10px');

                    // Outset arc (+16, consistent offset distance with other tests)
                    const outsetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.OUTSET
                    );
                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Arc;
                        const outsetShape: Shape = {
                            id: `arc-outset-${index}`,
                            type: GeometryType.ARC,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    // Inset arc (-16, consistent offset distance with other tests)
                    const insetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.INSET
                    );
                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Arc;
                        const insetShape: Shape = {
                            id: `arc-inset-${index}`,
                            type: GeometryType.ARC,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                // Add legend with consistent coloring
                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+16)' },
                    { color: 'blue', label: 'Inset (-16)' },
                ]);

                writeFileSync(
                    join(outputDir, 'arc-offsets-ccw.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for CW arc offsets with multiple sweep angles', () => {
                const testArcs = [
                    {
                        name: '120° arc',
                        arc: {
                            center: { x: 120, y: 80 },
                            radius: 60,
                            startAngle: (-60 * Math.PI) / 180, // -60° to +60° = 120° sweep
                            endAngle: (60 * Math.PI) / 180,
                            clockwise: true,
                        },
                        labelPos: { x: 120, y: 50 },
                    },
                    {
                        name: '180° arc',
                        arc: {
                            center: { x: 280, y: 80 },
                            radius: 60,
                            startAngle: 0, // 0° to 180° = 180° sweep
                            endAngle: Math.PI,
                            clockwise: true,
                        },
                        labelPos: { x: 280, y: 50 },
                    },
                    {
                        name: '270° arc',
                        arc: {
                            center: { x: 120, y: 220 },
                            radius: 60,
                            startAngle: 0, // 0° to 270° = 270° sweep
                            endAngle: (3 * Math.PI) / 2,
                            clockwise: true,
                        },
                        labelPos: { x: 120, y: 190 },
                    },
                    {
                        name: 'Open Chain Arc',
                        arc: {
                            center: { x: 280, y: 220 },
                            radius: 30,
                            startAngle: Math.PI / 2, // 90° to 0° = 90° sweep
                            endAngle: 0,
                            clockwise: true,
                        },
                        labelPos: { x: 280, y: 190 },
                    },
                ];

                const svg = createSVG(450, 340);

                testArcs.forEach((testCase, index) => {
                    const { arc, labelPos, name } = testCase;

                    // Add center point for reference
                    const centerCircle: Circle = {
                        center: arc.center,
                        radius: 2,
                    };
                    const centerShape: Shape = {
                        id: `arc-center-${index}`,
                        type: GeometryType.CIRCLE,
                        geometry: centerCircle,
                    };
                    svg.addShape(centerShape, '#888', 1);

                    // Original arc in black (consistent with other tests)
                    const arcShape: Shape = {
                        id: `arc-${index}`,
                        type: GeometryType.ARC,
                        geometry: arc,
                    };
                    svg.addShape(arcShape, 'black', 2);
                    svg.addText(labelPos.x, labelPos.y, name, 'black', '10px');

                    // Outset arc (+16, consistent offset distance with other tests)
                    const outsetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.OUTSET
                    );
                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Arc;
                        const outsetShape: Shape = {
                            id: `arc-outset-${index}`,
                            type: GeometryType.ARC,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    // Inset arc (-16, consistent offset distance with other tests)
                    const insetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.INSET
                    );
                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Arc;
                        const insetShape: Shape = {
                            id: `arc-inset-${index}`,
                            type: GeometryType.ARC,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                // Add legend with consistent coloring
                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+16)' },
                    { color: 'blue', label: 'Inset (-16)' },
                ]);

                writeFileSync(
                    join(outputDir, 'arc-offsets-cw.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for CCW arc offsets with flipped endpoints', () => {
                const testArcs = [
                    {
                        name: '120° arc',
                        arc: {
                            center: { x: 120, y: 80 },
                            radius: 60,
                            startAngle: (60 * Math.PI) / 180, // Flipped: was -60° to +60°, now +60° to -60°
                            endAngle: (-60 * Math.PI) / 180,
                            clockwise: false,
                        },
                        labelPos: { x: 120, y: 50 },
                    },
                    {
                        name: '180° arc',
                        arc: {
                            center: { x: 280, y: 80 },
                            radius: 60,
                            startAngle: Math.PI, // Flipped: was 0° to 180°, now 180° to 0°
                            endAngle: 0,
                            clockwise: false,
                        },
                        labelPos: { x: 280, y: 50 },
                    },
                    {
                        name: '270° arc',
                        arc: {
                            center: { x: 120, y: 220 },
                            radius: 60,
                            startAngle: (3 * Math.PI) / 2, // Flipped: was 0° to 270°, now 270° to 0°
                            endAngle: 0,
                            clockwise: false,
                        },
                        labelPos: { x: 120, y: 190 },
                    },
                    {
                        name: 'Open Chain Arc',
                        arc: {
                            center: { x: 280, y: 220 },
                            radius: 30,
                            startAngle: 0, // Flipped: was 90° to 0°, now 0° to 90°
                            endAngle: Math.PI / 2,
                            clockwise: false,
                        },
                        labelPos: { x: 280, y: 190 },
                    },
                ];

                const svg = createSVG(450, 340);

                testArcs.forEach((testCase, index) => {
                    const { arc, labelPos, name } = testCase;

                    // Add center point for reference
                    const centerCircle: Circle = {
                        center: arc.center,
                        radius: 2,
                    };
                    const centerShape: Shape = {
                        id: `arc-center-${index}`,
                        type: GeometryType.CIRCLE,
                        geometry: centerCircle,
                    };
                    svg.addShape(centerShape, '#888', 1);

                    // Original arc in black (consistent with other tests)
                    const arcShape: Shape = {
                        id: `arc-${index}`,
                        type: GeometryType.ARC,
                        geometry: arc,
                    };
                    svg.addShape(arcShape, 'black', 2);
                    svg.addText(labelPos.x, labelPos.y, name, 'black', '10px');

                    // Outset arc (+16, consistent offset distance with other tests)
                    const outsetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.OUTSET
                    );
                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Arc;
                        const outsetShape: Shape = {
                            id: `arc-outset-${index}`,
                            type: GeometryType.ARC,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    // Inset arc (-16, consistent offset distance with other tests)
                    const insetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.INSET
                    );
                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Arc;
                        const insetShape: Shape = {
                            id: `arc-inset-${index}`,
                            type: GeometryType.ARC,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                // Add legend with consistent coloring
                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+16)' },
                    { color: 'blue', label: 'Inset (-16)' },
                ]);

                writeFileSync(
                    join(outputDir, 'arc-offsets-ccw-flip.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for CW arc offsets with flipped endpoints', () => {
                const testArcs = [
                    {
                        name: '120° arc',
                        arc: {
                            center: { x: 120, y: 80 },
                            radius: 60,
                            startAngle: (60 * Math.PI) / 180, // Flipped: was -60° to +60°, now +60° to -60°
                            endAngle: (-60 * Math.PI) / 180,
                            clockwise: true,
                        },
                        labelPos: { x: 120, y: 50 },
                    },
                    {
                        name: '180° arc',
                        arc: {
                            center: { x: 280, y: 80 },
                            radius: 60,
                            startAngle: Math.PI, // Flipped: was 0° to 180°, now 180° to 0°
                            endAngle: 0,
                            clockwise: true,
                        },
                        labelPos: { x: 280, y: 50 },
                    },
                    {
                        name: '270° arc',
                        arc: {
                            center: { x: 120, y: 220 },
                            radius: 60,
                            startAngle: (3 * Math.PI) / 2, // Flipped: was 0° to 270°, now 270° to 0°
                            endAngle: 0,
                            clockwise: true,
                        },
                        labelPos: { x: 120, y: 190 },
                    },
                    {
                        name: 'Open Chain Arc',
                        arc: {
                            center: { x: 280, y: 220 },
                            radius: 30,
                            startAngle: 0, // Flipped: was 90° to 0°, now 0° to 90°
                            endAngle: Math.PI / 2,
                            clockwise: true,
                        },
                        labelPos: { x: 280, y: 190 },
                    },
                ];

                const svg = createSVG(450, 340);

                testArcs.forEach((testCase, index) => {
                    const { arc, labelPos, name } = testCase;

                    // Add center point for reference
                    const centerCircle: Circle = {
                        center: arc.center,
                        radius: 2,
                    };
                    const centerShape: Shape = {
                        id: `arc-center-${index}`,
                        type: GeometryType.CIRCLE,
                        geometry: centerCircle,
                    };
                    svg.addShape(centerShape, '#888', 1);

                    // Original arc in black (consistent with other tests)
                    const arcShape: Shape = {
                        id: `arc-${index}`,
                        type: GeometryType.ARC,
                        geometry: arc,
                    };
                    svg.addShape(arcShape, 'black', 2);
                    svg.addText(labelPos.x, labelPos.y, name, 'black', '10px');

                    // Outset arc (+16, consistent offset distance with other tests)
                    const outsetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.OUTSET
                    );
                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Arc;
                        const outsetShape: Shape = {
                            id: `arc-outset-${index}`,
                            type: GeometryType.ARC,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    // Inset arc (-16, consistent offset distance with other tests)
                    const insetResult = offsetArc(
                        arc,
                        16,
                        OffsetDirection.INSET
                    );
                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Arc;
                        const insetShape: Shape = {
                            id: `arc-inset-${index}`,
                            type: GeometryType.ARC,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                // Add legend with consistent coloring
                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+16)' },
                    { color: 'blue', label: 'Inset (-16)' },
                ]);

                writeFileSync(
                    join(outputDir, 'arc-offsets-cw-flip.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });
        });

        describe('Polyline offset visualization', () => {
            it('should generate SVG for polyline offsets (both open and closed)', () => {
                // Test both open and closed polylines in one comprehensive test
                const testPolylines: Array<{
                    polyline: Polyline;
                    label: string;
                }> = [
                    // Closed polylines (polygons)
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 80, y: 80, bulge: 0 },
                                { x: 160, y: 80, bulge: 0 },
                                { x: 160, y: 160, bulge: 0 },
                                { x: 80, y: 160, bulge: 0 },
                            ],
                            true
                        ).geometry as Polyline,
                        label: 'Square',
                    },
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 220, y: 80, bulge: 0 },
                                { x: 320, y: 160, bulge: 0 },
                                { x: 180, y: 160, bulge: 0 },
                            ],
                            true
                        ).geometry as Polyline,
                        label: 'Triangle',
                    },
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 60, y: 220, bulge: 0 },
                                { x: 140, y: 220, bulge: 0 },
                                { x: 140, y: 260, bulge: 0 },
                                { x: 100, y: 260, bulge: 0 },
                                { x: 100, y: 340, bulge: 0 },
                                { x: 60, y: 340, bulge: 0 },
                            ],
                            true
                        ).geometry as Polyline,
                        label: 'L-shape',
                    },
                    // Open polylines
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 200, y: 220, bulge: 0 },
                                { x: 280, y: 220, bulge: 0 },
                                { x: 320, y: 260, bulge: 0 },
                                { x: 360, y: 220, bulge: 0 },
                            ],
                            false
                        ).geometry as Polyline,
                        label: 'Open Path',
                    },
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 200, y: 300, bulge: 0 },
                                { x: 240, y: 340, bulge: 0 },
                                { x: 280, y: 300, bulge: 0 },
                                { x: 320, y: 340, bulge: 0 },
                                { x: 360, y: 300, bulge: 0 },
                            ],
                            false
                        ).geometry as Polyline,
                        label: 'Zigzag',
                    },
                ];

                const svg = createSVG(400, 450);

                testPolylines.forEach(({ polyline, label }) => {
                    // Original polyline in black
                    const originalShape: Shape = {
                        id: `polyline-${label}`,
                        type: GeometryType.POLYLINE,
                        geometry: polyline,
                    };
                    svg.addShape(originalShape, 'black', 2);

                    // Offset polylines
                    const outsetResult = offsetPolyline(
                        polyline,
                        8,
                        OffsetDirection.OUTSET
                    );
                    const insetResult = offsetPolyline(
                        polyline,
                        8,
                        OffsetDirection.INSET
                    );

                    if (
                        outsetResult.success &&
                        outsetResult.shapes.length > 0
                    ) {
                        outsetResult.shapes.forEach((shape) => {
                            const polylineGeometry = shape.geometry as Polyline;
                            const outsetShape: Shape = {
                                id: `polyline-outset-${label}`,
                                type: GeometryType.POLYLINE,
                                geometry: polylineGeometry,
                            };
                            svg.addShape(outsetShape, 'red', 1);
                        });
                    }

                    if (insetResult.success && insetResult.shapes.length > 0) {
                        insetResult.shapes.forEach((shape) => {
                            const polylineGeometry = shape.geometry as Polyline;
                            const insetShape: Shape = {
                                id: `polyline-inset-${label}`,
                                type: GeometryType.POLYLINE,
                                geometry: polylineGeometry,
                            };
                            svg.addShape(insetShape, 'blue', 1);
                        });
                    }
                });

                svg.addLegend([
                    { color: 'black', label: 'Original (Open &amp; Closed)' },
                    { color: 'red', label: 'Outset (+8)' },
                    { color: 'blue', label: 'Inset (-8)' },
                ]);

                writeFileSync(
                    join(outputDir, 'polyline-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for chain-wrapped polyline offsets', async () => {
                // Same polyline test but wrapped in chains and using offsetChain
                const testPolylines: Array<{
                    polyline: Polyline;
                    label: string;
                }> = [
                    // Closed polylines (polygons)
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 80, y: 80, bulge: 0 },
                                { x: 160, y: 80, bulge: 0 },
                                { x: 160, y: 160, bulge: 0 },
                                { x: 80, y: 160, bulge: 0 },
                            ],
                            true
                        ).geometry as Polyline,
                        label: 'Square',
                    },
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 220, y: 80, bulge: 0 },
                                { x: 320, y: 160, bulge: 0 },
                                { x: 180, y: 160, bulge: 0 },
                            ],
                            true
                        ).geometry as Polyline,
                        label: 'Triangle',
                    },
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 60, y: 220, bulge: 0 },
                                { x: 140, y: 220, bulge: 0 },
                                { x: 140, y: 260, bulge: 0 },
                                { x: 100, y: 260, bulge: 0 },
                                { x: 100, y: 340, bulge: 0 },
                                { x: 60, y: 340, bulge: 0 },
                            ],
                            true
                        ).geometry as Polyline,
                        label: 'L-shape',
                    },
                    // Open polylines
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 200, y: 220, bulge: 0 },
                                { x: 280, y: 220, bulge: 0 },
                                { x: 320, y: 260, bulge: 0 },
                                { x: 360, y: 220, bulge: 0 },
                            ],
                            false
                        ).geometry as Polyline,
                        label: 'Open Path',
                    },
                    {
                        polyline: createPolylineFromVertices(
                            [
                                { x: 200, y: 300, bulge: 0 },
                                { x: 240, y: 340, bulge: 0 },
                                { x: 280, y: 300, bulge: 0 },
                                { x: 320, y: 340, bulge: 0 },
                                { x: 360, y: 300, bulge: 0 },
                            ],
                            false
                        ).geometry as Polyline,
                        label: 'Zigzag',
                    },
                ];

                const svg = createSVG(400, 450);

                testPolylines.forEach(({ polyline, label }) => {
                    // Wrap polyline in a chain
                    const chain: Chain = {
                        id: `${label}-chain`,
                        shapes: [
                            {
                                id: '',
                                type: GeometryType.POLYLINE as const,
                                geometry: polyline,
                            },
                        ],
                    };

                    // Original polyline in black
                    const originalShape: Shape = {
                        id: `polyline-${label}`,
                        type: GeometryType.POLYLINE,
                        geometry: polyline,
                    };
                    svg.addShape(originalShape, 'black', 2);

                    // Offset chain using offsetChain with polylineIntersections enabled
                    const chainParams = {
                        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
                        polylineIntersections: true,
                    };
                    const outsetResult: ChainOffsetResult = offsetChain(
                        chain,
                        8,
                        chainParams
                    );
                    const insetResult: ChainOffsetResult = offsetChain(
                        chain,
                        -8,
                        chainParams
                    );

                    // Handle outset results - positive offset creates outer chain
                    if (outsetResult.success && outsetResult.outerChain) {
                        outsetResult.outerChain.shapes.forEach(
                            (shape: Shape) => {
                                if (shape.type === 'polyline') {
                                    const polylineGeometry =
                                        shape.geometry as Polyline;
                                    const outsetShape: Shape = {
                                        id: `polyline-outset-${label}`,
                                        type: GeometryType.POLYLINE,
                                        geometry: polylineGeometry,
                                    };
                                    svg.addShape(outsetShape, 'red', 1);
                                }
                            }
                        );
                    }

                    // Handle inset results - negative offset creates inner chain
                    if (insetResult.success && insetResult.innerChain) {
                        insetResult.innerChain.shapes.forEach(
                            (shape: Shape) => {
                                if (shape.type === 'polyline') {
                                    const polylineGeometry =
                                        shape.geometry as Polyline;
                                    const insetShape: Shape = {
                                        id: `polyline-inset-${label}`,
                                        type: GeometryType.POLYLINE,
                                        geometry: polylineGeometry,
                                    };
                                    svg.addShape(insetShape, 'blue', 1);
                                }
                            }
                        );
                    }
                });

                svg.addLegend([
                    { color: 'black', label: 'Original (Chain-wrapped)' },
                    { color: 'red', label: 'Chain Outset (+8)' },
                    { color: 'blue', label: 'Chain Inset (-8)' },
                ]);

                writeFileSync(
                    join(outputDir, 'polyline-chain-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for chain-wrapped short polyline offsets', async () => {
                // Function to break up lines longer than maxLength
                const breakUpPolyline = (
                    polyline: Polyline,
                    maxLength: number
                ): Polyline => {
                    const newShapes: Shape[] = [];

                    polyline.shapes.forEach((shape) => {
                        if (shape.type === 'line') {
                            const line = shape.geometry as Line;
                            const dx = line.end.x - line.start.x;
                            const dy = line.end.y - line.start.y;
                            const totalLength = Math.sqrt(dx * dx + dy * dy);

                            if (totalLength <= maxLength) {
                                // Line is already short enough
                                newShapes.push(shape);
                            } else {
                                // Break into segments
                                const numSegments = Math.ceil(
                                    totalLength / maxLength
                                );
                                for (let i = 0; i < numSegments; i++) {
                                    const t1 = i / numSegments;
                                    const t2 = (i + 1) / numSegments;

                                    const start = {
                                        x: line.start.x + t1 * dx,
                                        y: line.start.y + t1 * dy,
                                    };
                                    const end = {
                                        x: line.start.x + t2 * dx,
                                        y: line.start.y + t2 * dy,
                                    };

                                    newShapes.push({
                                        id: `${shape.id}-seg-${i}`,
                                        type: GeometryType.LINE as const,
                                        geometry: { start, end },
                                    });
                                }
                            }
                        } else {
                            // Non-line shapes are kept as-is
                            newShapes.push(shape);
                        }
                    });

                    return {
                        ...polyline,
                        shapes: newShapes,
                    };
                };

                // Test polylines with short segments wrapped in chains
                const testPolylines: Array<{
                    polyline: Polyline;
                    label: string;
                }> = [
                    // Closed polylines (polygons)
                    {
                        polyline: breakUpPolyline(
                            createPolylineFromVertices(
                                [
                                    { x: 80, y: 80, bulge: 0 },
                                    { x: 160, y: 80, bulge: 0 },
                                    { x: 160, y: 160, bulge: 0 },
                                    { x: 80, y: 160, bulge: 0 },
                                ],
                                true
                            ).geometry as Polyline,
                            2
                        ),
                        label: 'Square',
                    },
                    {
                        polyline: breakUpPolyline(
                            createPolylineFromVertices(
                                [
                                    { x: 220, y: 80, bulge: 0 },
                                    { x: 320, y: 160, bulge: 0 },
                                    { x: 180, y: 160, bulge: 0 },
                                ],
                                true
                            ).geometry as Polyline,
                            2
                        ),
                        label: 'Triangle',
                    },
                    {
                        polyline: breakUpPolyline(
                            createPolylineFromVertices(
                                [
                                    { x: 60, y: 220, bulge: 0 },
                                    { x: 140, y: 220, bulge: 0 },
                                    { x: 140, y: 260, bulge: 0 },
                                    { x: 100, y: 260, bulge: 0 },
                                    { x: 100, y: 340, bulge: 0 },
                                    { x: 60, y: 340, bulge: 0 },
                                ],
                                true
                            ).geometry as Polyline,
                            2
                        ),
                        label: 'L-shape',
                    },
                    // Open polylines
                    {
                        polyline: breakUpPolyline(
                            createPolylineFromVertices(
                                [
                                    { x: 200, y: 220, bulge: 0 },
                                    { x: 280, y: 220, bulge: 0 },
                                    { x: 320, y: 260, bulge: 0 },
                                    { x: 360, y: 220, bulge: 0 },
                                ],
                                false
                            ).geometry as Polyline,
                            2
                        ),
                        label: 'Open Path',
                    },
                    {
                        polyline: breakUpPolyline(
                            createPolylineFromVertices(
                                [
                                    { x: 200, y: 300, bulge: 0 },
                                    { x: 240, y: 340, bulge: 0 },
                                    { x: 280, y: 300, bulge: 0 },
                                    { x: 320, y: 340, bulge: 0 },
                                    { x: 360, y: 300, bulge: 0 },
                                ],
                                false
                            ).geometry as Polyline,
                            2
                        ),
                        label: 'Zigzag',
                    },
                ];

                const svg = createSVG(400, 450);

                testPolylines.forEach(({ polyline, label }) => {
                    // Wrap polyline in a chain
                    const chain: Chain = {
                        id: `${label}-chain`,
                        shapes: [
                            {
                                id: '',
                                type: GeometryType.POLYLINE as const,
                                geometry: polyline,
                            },
                        ],
                    };

                    // Original polyline in black
                    const originalShape: Shape = {
                        id: `polyline-${label}`,
                        type: GeometryType.POLYLINE,
                        geometry: polyline,
                    };
                    svg.addShape(originalShape, 'black', 2);

                    // Offset chain using offsetChain with polylineIntersections enabled and true intersection type
                    const chainParams = {
                        ...DEFAULT_CHAIN_OFFSET_PARAMETERS,
                        polylineIntersections: true,
                        intersectionType: 'true' as const,
                    };
                    console.log(
                        `Processing ${label} with chainParams:`,
                        chainParams.intersectionType
                    );
                    const outsetResult: ChainOffsetResult = offsetChain(
                        chain,
                        8,
                        chainParams
                    );
                    const insetResult: ChainOffsetResult = offsetChain(
                        chain,
                        -8,
                        chainParams
                    );

                    // Handle outset results - positive offset creates outer chain
                    if (outsetResult.success && outsetResult.outerChain) {
                        outsetResult.outerChain.shapes.forEach(
                            (shape: Shape) => {
                                if (shape.type === 'polyline') {
                                    const polylineGeometry =
                                        shape.geometry as Polyline;
                                    const outsetShape: Shape = {
                                        id: `polyline-outset-${label}`,
                                        type: GeometryType.POLYLINE,
                                        geometry: polylineGeometry,
                                    };
                                    svg.addShape(outsetShape, 'red', 1);
                                }
                            }
                        );

                        console.log(
                            'Outset intersections:',
                            outsetResult.outerChain.intersectionPoints
                                ?.length || 0
                        );

                        // Add yellow circles for intersection points
                        if (outsetResult.outerChain.intersectionPoints) {
                            outsetResult.outerChain.intersectionPoints.forEach(
                                (intersection, _idx) => {
                                    svg.addIntersectionPoint(
                                        intersection.point,
                                        'yellow',
                                        1
                                    );
                                }
                            );
                        }
                    }

                    // Handle inset results - negative offset creates inner chain
                    if (insetResult.success && insetResult.innerChain) {
                        insetResult.innerChain.shapes.forEach(
                            (shape: Shape) => {
                                if (shape.type === 'polyline') {
                                    const polylineGeometry =
                                        shape.geometry as Polyline;
                                    const insetShape: Shape = {
                                        id: `polyline-inset-${label}`,
                                        type: GeometryType.POLYLINE,
                                        geometry: polylineGeometry,
                                    };
                                    svg.addShape(insetShape, 'blue', 1);
                                }
                            }
                        );

                        console.log(
                            'Inset intersections:',
                            insetResult.innerChain.intersectionPoints?.length ||
                                0
                        );

                        // Add yellow circles for intersection points
                        if (insetResult.innerChain.intersectionPoints) {
                            insetResult.innerChain.intersectionPoints.forEach(
                                (intersection, _idx) => {
                                    svg.addIntersectionPoint(
                                        intersection.point,
                                        'yellow',
                                        1
                                    );
                                }
                            );
                        }
                    }
                });

                svg.addLegend([
                    { color: 'black', label: 'Original (Short Segments)' },
                    { color: 'red', label: 'Chain Outset (+8)' },
                    { color: 'blue', label: 'Chain Inset (-8)' },
                    { color: 'yellow', label: 'Intersection Points' },
                ]);

                writeFileSync(
                    join(outputDir, 'polyline-chain-short-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for complex self-intersecting shapes', () => {
                // Base shapes - we'll create both CW and CCW versions
                const baseShapes = [
                    {
                        name: 'Figure-8',
                        ccwPoints: [
                            { x: 40, y: 60 },
                            { x: 100, y: 30 },
                            { x: 160, y: 60 },
                            { x: 100, y: 90 },
                            { x: 40, y: 60 },
                        ],
                        labelPos: { x: 100, y: 110 },
                    },
                    {
                        name: 'Star',
                        ccwPoints: [
                            { x: 100, y: 30 }, // Top
                            { x: 106, y: 50 }, // Inner
                            { x: 130, y: 50 }, // Right outer
                            { x: 114, y: 65 }, // Inner
                            { x: 122, y: 90 }, // Bottom right
                            { x: 100, y: 75 }, // Inner
                            { x: 78, y: 90 }, // Bottom left
                            { x: 86, y: 65 }, // Inner
                            { x: 70, y: 50 }, // Left outer
                            { x: 94, y: 50 }, // Inner
                        ],
                        labelPos: { x: 100, y: 110 },
                    },
                ];

                const svg = createSVG(600, 400);

                baseShapes.forEach((baseShape, shapeIndex) => {
                    const yOffset = shapeIndex * 160; // Separate shapes vertically

                    // Create CCW version (left side)
                    const ccwShape = createPolylineFromVertices(
                        baseShape.ccwPoints.map((p) => ({
                            x: p.x + 30,
                            y: p.y + yOffset + 30,
                            bulge: 0,
                        })),
                        true
                    );

                    // Create CW version (right side, reverse the points)
                    const cwShape = createPolylineFromVertices(
                        [...baseShape.ccwPoints].reverse().map((p) => ({
                            x: p.x + 330,
                            y: p.y + yOffset + 30,
                            bulge: 0,
                        })),
                        true
                    );

                    // Note: calculateSignedArea is now imported from geometry-utils module

                    // Process CCW shape
                    const ccwPoints = polylineToPoints(
                        ccwShape.geometry as Polyline
                    );
                    const ccwArea = calculateSignedArea(ccwPoints);
                    const ccwWinding = ccwArea > 0 ? 'CW' : 'CCW';

                    // Original CCW shape in black
                    const ccwShapeObj: Shape = {
                        id: `ccw-shape-${shapeIndex}`,
                        type: GeometryType.POLYLINE,
                        geometry: ccwShape.geometry,
                    };
                    svg.addShape(ccwShapeObj, 'black', 2);

                    // Offsets for CCW shape
                    if (!isPolylineShape(ccwShape)) {
                        throw new Error(
                            `Expected polyline shape, got ${ccwShape.type}`
                        );
                    }
                    const ccwOutsetResult = offsetPolyline(
                        ccwShape.geometry,
                        8,
                        OffsetDirection.OUTSET
                    );
                    const ccwInsetResult = offsetPolyline(
                        ccwShape.geometry,
                        8,
                        OffsetDirection.INSET
                    );

                    if (
                        ccwOutsetResult.success &&
                        ccwOutsetResult.shapes.length > 0
                    ) {
                        ccwOutsetResult.shapes.forEach(
                            (offsetShape, offsetIdx) => {
                                const polylineGeometry =
                                    offsetShape.geometry as Polyline;
                                const outsetShape: Shape = {
                                    id: `ccw-outset-${shapeIndex}-${offsetIdx}`,
                                    type: GeometryType.POLYLINE,
                                    geometry: polylineGeometry,
                                };
                                svg.addShape(outsetShape, 'red', 1);
                            }
                        );
                    }

                    if (
                        ccwInsetResult.success &&
                        ccwInsetResult.shapes.length > 0
                    ) {
                        ccwInsetResult.shapes.forEach(
                            (offsetShape, offsetIdx) => {
                                const polylineGeometry =
                                    offsetShape.geometry as Polyline;
                                const insetShape: Shape = {
                                    id: `ccw-inset-${shapeIndex}-${offsetIdx}`,
                                    type: GeometryType.POLYLINE,
                                    geometry: polylineGeometry,
                                };
                                svg.addShape(insetShape, 'blue', 1);
                            }
                        );
                    }

                    // Add CCW label
                    svg.addText(
                        baseShape.labelPos.x + 30,
                        baseShape.labelPos.y + yOffset + 30,
                        `${baseShape.name} (${ccwWinding})`,
                        'black',
                        '12px'
                    );

                    // Process CW shape
                    const cwPoints = polylineToPoints(
                        cwShape.geometry as Polyline
                    );
                    const cwArea = calculateSignedArea(cwPoints);
                    const cwWinding = cwArea > 0 ? 'CW' : 'CCW';

                    // Original CW shape in black
                    const cwShapeObj: Shape = {
                        id: `cw-shape-${shapeIndex}`,
                        type: GeometryType.POLYLINE,
                        geometry: cwShape.geometry,
                    };
                    svg.addShape(cwShapeObj, 'black', 2);

                    // Offsets for CW shape
                    if (!isPolylineShape(cwShape)) {
                        throw new Error(
                            `Expected polyline shape, got ${cwShape.type}`
                        );
                    }
                    const cwOutsetResult = offsetPolyline(
                        cwShape.geometry,
                        8,
                        OffsetDirection.OUTSET
                    );
                    const cwInsetResult = offsetPolyline(
                        cwShape.geometry,
                        8,
                        OffsetDirection.INSET
                    );

                    if (
                        cwOutsetResult.success &&
                        cwOutsetResult.shapes.length > 0
                    ) {
                        cwOutsetResult.shapes.forEach(
                            (offsetShape, offsetIdx) => {
                                const polylineGeometry =
                                    offsetShape.geometry as Polyline;
                                const outsetShape: Shape = {
                                    id: `cw-outset-${shapeIndex}-${offsetIdx}`,
                                    type: GeometryType.POLYLINE,
                                    geometry: polylineGeometry,
                                };
                                svg.addShape(outsetShape, 'red', 1);
                            }
                        );
                    }

                    if (
                        cwInsetResult.success &&
                        cwInsetResult.shapes.length > 0
                    ) {
                        cwInsetResult.shapes.forEach(
                            (offsetShape, offsetIdx) => {
                                const polylineGeometry =
                                    offsetShape.geometry as Polyline;
                                const insetShape: Shape = {
                                    id: `cw-inset-${shapeIndex}-${offsetIdx}`,
                                    type: GeometryType.POLYLINE,
                                    geometry: polylineGeometry,
                                };
                                svg.addShape(insetShape, 'blue', 1);
                            }
                        );
                    }

                    // Add CW label
                    svg.addText(
                        baseShape.labelPos.x + 330,
                        baseShape.labelPos.y + yOffset + 30,
                        `${baseShape.name} (${cwWinding})`,
                        'black',
                        '12px'
                    );
                });

                svg.addLegend([
                    { color: 'black', label: 'Original Complex Shapes' },
                    { color: 'red', label: 'Outset (+8)' },
                    { color: 'blue', label: 'Inset (-8)' },
                ]);

                writeFileSync(
                    join(outputDir, 'complex-shapes-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });
        });

        describe('Spline offset visualization', () => {
            it('should generate SVG for custom degree-3 spline offset', () => {
                // Custom spline with degree=3, 4 control points
                const customSpline: Spline = {
                    controlPoints: [
                        { x: 38.42, y: 19.33 },
                        { x: 38.42, y: 18.86 },
                        { x: 38.3, y: 18.49 },
                        { x: 38.05, y: 18.22 },
                    ],
                    degree: 3,
                    knots: [0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0], // degree 3, 4 control points: n+p+1 = 4+3+1 = 8 knots
                    weights: [1.0, 1.0, 1.0, 1.0], // 4 weights for 4 control points
                    fitPoints: [],
                    closed: false,
                };

                const svg = createSVG(400, 300);
                const offsetDistance = 5;

                // Translate spline to center of canvas
                const translatedSpline: Spline = {
                    ...customSpline,
                    controlPoints: customSpline.controlPoints.map((p) => ({
                        x: p.x * 5 + 100, // Scale up and center horizontally
                        y: p.y * 5 + 100, // Scale up and center vertically
                    })),
                };

                // Add original spline directly
                const originalShape: Shape = {
                    id: 'original-custom-degree3-spline',
                    type: GeometryType.SPLINE,
                    geometry: translatedSpline,
                };
                svg.addShape(originalShape, '#0077be', 3);

                // Outset offset
                const outsetResult = offsetSpline(
                    translatedSpline,
                    offsetDistance,
                    OffsetDirection.OUTSET,
                    0.1,
                    5
                );

                if (outsetResult.success && outsetResult.shapes.length > 0) {
                    const outsetShape: Shape = {
                        id: 'outset-custom-degree3-spline',
                        type: GeometryType.SPLINE,
                        geometry: outsetResult.shapes[0].geometry,
                    };
                    svg.addShape(outsetShape, '#2ca02c', 1.5);
                }

                // Inset offset
                const insetResult = offsetSpline(
                    translatedSpline,
                    offsetDistance,
                    OffsetDirection.INSET,
                    0.1,
                    5
                );

                if (insetResult.success && insetResult.shapes.length > 0) {
                    const insetShape: Shape = {
                        id: 'inset-custom-degree3-spline',
                        type: GeometryType.SPLINE,
                        geometry: insetResult.shapes[0].geometry,
                    };
                    svg.addShape(insetShape, '#d62728', 1.5);
                }

                svg.addLegend([
                    { color: '#0077be', label: 'Original Degree-3 Spline' },
                    { color: '#2ca02c', label: 'Outer Offset (+5)' },
                    { color: '#d62728', label: 'Inner Offset (-5)' },
                ]);

                writeFileSync(
                    join(outputDir, 'spline-degree-3-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for custom degree-2 spline offset', () => {
                // Custom spline with degree=2, 3 control points
                const customSpline: Spline = {
                    controlPoints: [
                        { x: -71.48, y: 86.56 },
                        { x: -66.52, y: 86.56 },
                        { x: -63.55, y: 89.17 },
                    ],
                    degree: 2,
                    knots: [0, 0, 0, 1, 1, 1], // degree 2, 3 control points: n+p+1 = 3+2+1 = 6 knots
                    weights: [1, 1, 1], // 3 weights for 3 control points
                    fitPoints: [],
                    closed: false,
                };

                const svg = createSVG(400, 300);
                const offsetDistance = 10;

                // Translate spline to center of canvas
                const translatedSpline: Spline = {
                    ...customSpline,
                    controlPoints: customSpline.controlPoints.map((p) => ({
                        x: p.x + 200, // Center horizontally
                        y: p.y + 100, // Center vertically
                    })),
                };

                // Add original spline directly
                const originalShape: Shape = {
                    id: 'original-custom-spline',
                    type: GeometryType.SPLINE,
                    geometry: translatedSpline,
                };
                svg.addShape(originalShape, '#0077be', 3);

                // Outset offset
                const outsetResult = offsetSpline(
                    translatedSpline,
                    offsetDistance,
                    OffsetDirection.OUTSET,
                    0.1,
                    5
                );

                if (outsetResult.success && outsetResult.shapes.length > 0) {
                    const outsetShape: Shape = {
                        id: 'outset-custom-spline',
                        type: GeometryType.SPLINE,
                        geometry: outsetResult.shapes[0].geometry,
                    };
                    svg.addShape(outsetShape, '#2ca02c', 1.5);
                }

                // Inset offset
                const insetResult = offsetSpline(
                    translatedSpline,
                    offsetDistance,
                    OffsetDirection.INSET,
                    0.1,
                    5
                );

                if (insetResult.success && insetResult.shapes.length > 0) {
                    const insetShape: Shape = {
                        id: 'inset-custom-spline',
                        type: GeometryType.SPLINE,
                        geometry: insetResult.shapes[0].geometry,
                    };
                    svg.addShape(insetShape, '#d62728', 1.5);
                }

                svg.addLegend([
                    { color: '#0077be', label: 'Original Degree-2 Spline' },
                    { color: '#2ca02c', label: 'Outer Offset (+10)' },
                    { color: '#d62728', label: 'Inner Offset (-10)' },
                ]);

                writeFileSync(
                    join(outputDir, 'spline-degree-2-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for spline offsets', () => {
                // Test both open and closed NURBS curves following the reference example
                const testSplines: Spline[] = [
                    // Open C-shaped curve (degree 3)
                    {
                        controlPoints: [
                            { x: 50, y: 250 },
                            { x: 150, y: 300 },
                            { x: 200, y: 200 },
                            { x: 250, y: 100 },
                            { x: 300, y: 50 },
                            { x: 400, y: 100 },
                        ],
                        degree: 3,
                        knots: [0, 0, 0, 0, 0.33, 0.66, 1, 1, 1, 1],
                        weights: [1, 1, 1, 1, 1, 1],
                        fitPoints: [],
                        closed: false,
                    },
                    // Closed curve - simple spline loop (degree 2 for simplicity)
                    {
                        controlPoints: [
                            { x: 100, y: 50 },
                            { x: 300, y: 50 },
                            { x: 350, y: 150 },
                            { x: 300, y: 250 },
                            { x: 100, y: 250 },
                            { x: 50, y: 150 },
                        ],
                        degree: 2,
                        knots: [0, 0, 0, 0.25, 0.5, 0.75, 1, 1, 1],
                        weights: [1, 1, 1, 1, 1, 1],
                        fitPoints: [],
                        closed: true,
                    },
                ];

                const svg = createSVG(450, 400);
                const offsetDistance = 25; // Use consistent offset distance from reference

                testSplines.forEach((spline, index) => {
                    const yOffset = index * 180; // Separate the curves vertically

                    // For visualization of the original spline, use the offset function with zero distance
                    const originalSpline: Spline = {
                        ...spline,
                        controlPoints: spline.controlPoints.map((p) => ({
                            x: p.x,
                            y: p.y + yOffset,
                        })),
                    };

                    // Get the original curve by using a tiny offset for visualization purposes
                    const originalStart = performance.now();
                    const originalResult = offsetSpline(
                        originalSpline,
                        0.1,
                        OffsetDirection.OUTSET,
                        1.0,
                        3
                    );
                    const originalDuration = performance.now() - originalStart;

                    if (
                        originalResult.success &&
                        originalResult.shapes.length > 0
                    ) {
                        const originalGeometry = originalResult.shapes[0]
                            .geometry as Spline;
                        // Tessellate the spline for visualization
                        const verbCurve =
                            verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                                originalGeometry.degree,
                                originalGeometry.knots,
                                originalGeometry.controlPoints.map((p) => [
                                    p.x,
                                    p.y,
                                    0,
                                ]),
                                originalGeometry.weights
                            );
                        const points = tessellateVerbCurve(verbCurve, 0.1);
                        const originalPolyline: Polyline = {
                            shapes: points.slice(0, -1).map((p, i) => ({
                                id: `original-spline-seg-${index}-${i}`,
                                type: GeometryType.LINE as const,
                                geometry: {
                                    start: p,
                                    end: points[i + 1],
                                } as Line,
                            })),
                            closed: originalGeometry.closed,
                        };
                        const originalShape: Shape = {
                            id: `original-spline-${index}`,
                            type: GeometryType.POLYLINE,
                            geometry: originalPolyline,
                        };
                        svg.addShape(originalShape, '#0077be', 3);
                    }

                    // Offset splines with translated y coordinates
                    const translatedSpline: Spline = {
                        ...spline,
                        controlPoints: spline.controlPoints.map((p) => ({
                            x: p.x,
                            y: p.y + yOffset,
                        })),
                    };

                    // Outer offset in green - use bounded refinements for visualization
                    const outsetStart = performance.now();
                    const outsetResult = offsetSpline(
                        translatedSpline,
                        offsetDistance,
                        OffsetDirection.OUTSET,
                        0.1,
                        5
                    );
                    const outsetDuration = performance.now() - outsetStart;

                    if (
                        outsetResult.success &&
                        outsetResult.shapes.length > 0
                    ) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Spline;
                        // Tessellate the spline for visualization
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
                        const points = tessellateVerbCurve(verbCurve, 0.1);
                        const outsetPolyline: Polyline = {
                            shapes: points.slice(0, -1).map((p, i) => ({
                                id: `outset-spline-seg-${index}-${i}`,
                                type: GeometryType.LINE as const,
                                geometry: {
                                    start: p,
                                    end: points[i + 1],
                                } as Line,
                            })),
                            closed: outsetGeometry.closed,
                        };
                        const outsetShape: Shape = {
                            id: `outset-spline-${index}`,
                            type: GeometryType.POLYLINE,
                            geometry: outsetPolyline,
                        };
                        svg.addShape(outsetShape, '#2ca02c', 1.5);
                    }

                    // Inner offset in red - use bounded refinements for visualization
                    const insetStart = performance.now();
                    const insetResult = offsetSpline(
                        translatedSpline,
                        offsetDistance,
                        OffsetDirection.INSET,
                        0.1,
                        5
                    );
                    const insetDuration = performance.now() - insetStart;

                    if (insetResult.success && insetResult.shapes.length > 0) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Spline;
                        // Tessellate the spline for visualization
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
                        const points = tessellateVerbCurve(verbCurve, 0.1);
                        const insetPolyline: Polyline = {
                            shapes: points.slice(0, -1).map((p, i) => ({
                                id: `inset-spline-seg-${index}-${i}`,
                                type: GeometryType.LINE as const,
                                geometry: {
                                    start: p,
                                    end: points[i + 1],
                                } as Line,
                            })),
                            closed: insetGeometry.closed,
                        };
                        const insetShape: Shape = {
                            id: `inset-spline-${index}`,
                            type: GeometryType.POLYLINE,
                            geometry: insetPolyline,
                        };
                        svg.addShape(insetShape, '#d62728', 1.5);
                    }

                    const _splineTotal =
                        originalDuration + outsetDuration + insetDuration;

                    // Add labels
                    const labelY = yOffset + (index === 0 ? -10 : 270);
                    svg.addText(
                        225,
                        labelY,
                        index === 0 ? 'Open NURBS Curve' : 'Closed NURBS Curve',
                        'black',
                        '14px'
                    );
                });

                svg.addLegend([
                    { color: '#0077be', label: 'Original' },
                    { color: '#2ca02c', label: 'Outer Offset' },
                    { color: '#d62728', label: 'Inner Offset' },
                ]);

                writeFileSync(
                    join(outputDir, 'spline-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });
        });

        describe('Ellipse offset visualization', () => {
            it('should generate SVG for ellipse approximation offsets', () => {
                const testEllipses: Ellipse[] = [
                    {
                        center: { x: 120, y: 120 },
                        majorAxisEndpoint: { x: 80, y: 0 },
                        minorToMajorRatio: 0.6,
                    },
                    {
                        center: { x: 280, y: 120 },
                        majorAxisEndpoint: { x: 0, y: 60 },
                        minorToMajorRatio: 0.8,
                    }, // Rotated
                    {
                        center: { x: 200, y: 280 },
                        majorAxisEndpoint: { x: 100, y: 0 },
                        minorToMajorRatio: 0.4,
                    },
                ];

                const svg = createSVG(400, 450);

                testEllipses.forEach((ellipse, ellipseIdx) => {
                    // Original ellipse (approximated as polyline for visualization)
                    // For zero offset, we get no shapes, so generate the approximation manually
                    const points = tessellateEllipse(ellipse, 32);
                    const ellipsePolyline: Polyline = {
                        shapes: points.slice(0, -1).map((p, i) => ({
                            id: `ellipse-seg-${ellipseIdx}-${i}`,
                            type: GeometryType.LINE as const,
                            geometry: { start: p, end: points[i + 1] } as Line,
                        })),
                        closed: true,
                    };
                    const ellipseShape: Shape = {
                        id: `ellipse-${ellipseIdx}`,
                        type: GeometryType.POLYLINE,
                        geometry: ellipsePolyline,
                    };
                    svg.addShape(ellipseShape, 'black', 2);

                    // Offset ellipses
                    const outsetResult = offsetEllipse(
                        ellipse,
                        12,
                        OffsetDirection.OUTSET
                    );
                    const insetResult = offsetEllipse(
                        ellipse,
                        8,
                        OffsetDirection.INSET
                    );

                    if (
                        outsetResult.success &&
                        outsetResult.shapes.length > 0
                    ) {
                        const outsetShape = outsetResult.shapes[0];
                        // All offsets are splines now
                        const splineGeometry = outsetShape.geometry as Spline;
                        const outsetPolyline: Polyline = {
                            shapes: splineGeometry.controlPoints
                                .slice(0, -1)
                                .map((p, i) => ({
                                    id: `ellipse-outset-seg-${ellipseIdx}-${i}`,
                                    type: GeometryType.LINE as const,
                                    geometry: {
                                        start: p,
                                        end: splineGeometry.controlPoints[
                                            i + 1
                                        ],
                                    } as Line,
                                })),
                            closed: splineGeometry.closed,
                        };
                        const outsetPolyShape: Shape = {
                            id: `ellipse-outset-${ellipseIdx}`,
                            type: GeometryType.POLYLINE,
                            geometry: outsetPolyline,
                        };
                        svg.addShape(outsetPolyShape, 'red', 1);
                    }

                    if (insetResult.success && insetResult.shapes.length > 0) {
                        const insetShape = insetResult.shapes[0];
                        // All offsets are splines now
                        const splineGeometry = insetShape.geometry as Spline;
                        const insetPolyline: Polyline = {
                            shapes: splineGeometry.controlPoints
                                .slice(0, -1)
                                .map((p, i) => ({
                                    id: `ellipse-inset-seg-${ellipseIdx}-${i}`,
                                    type: GeometryType.LINE as const,
                                    geometry: {
                                        start: p,
                                        end: splineGeometry.controlPoints[
                                            i + 1
                                        ],
                                    } as Line,
                                })),
                            closed: splineGeometry.closed,
                        };
                        const insetPolyShape: Shape = {
                            id: `ellipse-inset-${ellipseIdx}`,
                            type: GeometryType.POLYLINE,
                            geometry: insetPolyline,
                        };
                        svg.addShape(insetPolyShape, 'blue', 1);
                    }
                });

                svg.addLegend([
                    { color: 'black', label: 'Original Ellipse' },
                    { color: 'red', label: 'Outset (+12)' },
                    { color: 'blue', label: 'Inset (-8)' },
                ]);

                writeFileSync(
                    join(outputDir, 'ellipse-offsets.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });
        });

        describe('Ellipse Arc offset visualization', () => {
            it('should generate SVG for ellipse arc offsets with multiple sweep angles', () => {
                const testEllipseArcs = [
                    {
                        name: '120° arc',
                        ellipse: {
                            center: { x: 120, y: 80 },
                            majorAxisEndpoint: { x: 60, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: (-60 * Math.PI) / 180, // -60° to +60° = 120° sweep
                            endParam: (60 * Math.PI) / 180,
                        },
                        labelPos: { x: 120, y: 50 },
                    },
                    {
                        name: '180° arc',
                        ellipse: {
                            center: { x: 280, y: 80 },
                            majorAxisEndpoint: { x: 60, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: 0, // 0° to 180° = 180° sweep
                            endParam: Math.PI,
                        },
                        labelPos: { x: 280, y: 50 },
                    },
                    {
                        name: '270° arc',
                        ellipse: {
                            center: { x: 120, y: 220 },
                            majorAxisEndpoint: { x: 60, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: 0, // 0° to 270° = 270° sweep
                            endParam: (3 * Math.PI) / 2,
                        },
                        labelPos: { x: 120, y: 190 },
                    },
                    {
                        name: 'Open Chain Arc',
                        ellipse: {
                            center: { x: 280, y: 220 },
                            majorAxisEndpoint: { x: 30, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: Math.PI / 2, // 90° to 0° = 90° sweep
                            endParam: 0,
                        },
                        labelPos: { x: 280, y: 190 },
                    },
                ];

                const svg = createSVG(450, 340);

                testEllipseArcs.forEach((testCase, index) => {
                    const { ellipse, labelPos, name } = testCase;

                    // Add center point for reference
                    const centerCircle: Circle = {
                        center: ellipse.center,
                        radius: 2,
                    };
                    const centerShape: Shape = {
                        id: `ellipse-center-${index}`,
                        type: GeometryType.CIRCLE,
                        geometry: centerCircle,
                    };
                    svg.addShape(centerShape, '#888', 1);

                    // Original ellipse arc in black (consistent with other tests)
                    const ellipseShape: Shape = {
                        id: `ellipse-arc-${index}`,
                        type: GeometryType.ELLIPSE,
                        geometry: ellipse,
                    };
                    svg.addShape(ellipseShape, 'black', 2);
                    svg.addText(labelPos.x, labelPos.y, name, 'black', '10px');

                    // Outset ellipse arc (+16, consistent offset distance with other tests)
                    const outsetResult = offsetEllipse(
                        ellipse,
                        16,
                        OffsetDirection.OUTSET
                    );
                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Spline;
                        const outsetShape: Shape = {
                            id: `ellipse-outset-spline-${index}`,
                            type: GeometryType.SPLINE,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    // Inset ellipse arc (-16, consistent offset distance with other tests)
                    const insetResult = offsetEllipse(
                        ellipse,
                        16,
                        OffsetDirection.INSET
                    );
                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Spline;
                        const insetShape: Shape = {
                            id: `ellipse-inset-spline-${index}`,
                            type: GeometryType.SPLINE,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                // Add legend with consistent coloring
                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+16)' },
                    { color: 'blue', label: 'Inset (-16)' },
                ]);

                writeFileSync(
                    join(outputDir, 'ellipsearc-offsets-ccw.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });

            it('should generate SVG for CCW ellipse arc offsets with flipped endpoints', () => {
                const testEllipseArcs = [
                    {
                        name: '120° arc',
                        ellipse: {
                            center: { x: 120, y: 80 },
                            majorAxisEndpoint: { x: 60, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: (60 * Math.PI) / 180, // Flipped: was -60° to +60°, now +60° to -60°
                            endParam: (-60 * Math.PI) / 180,
                        },
                        labelPos: { x: 120, y: 50 },
                    },
                    {
                        name: '180° arc',
                        ellipse: {
                            center: { x: 280, y: 80 },
                            majorAxisEndpoint: { x: 60, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: Math.PI, // Flipped: was 0° to 180°, now 180° to 0°
                            endParam: 0,
                        },
                        labelPos: { x: 280, y: 50 },
                    },
                    {
                        name: '270° arc',
                        ellipse: {
                            center: { x: 120, y: 220 },
                            majorAxisEndpoint: { x: 60, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: (3 * Math.PI) / 2, // Flipped: was 0° to 270°, now 270° to 0°
                            endParam: 0,
                        },
                        labelPos: { x: 120, y: 190 },
                    },
                    {
                        name: 'Open Chain Arc',
                        ellipse: {
                            center: { x: 280, y: 220 },
                            majorAxisEndpoint: { x: 30, y: 0 }, // radius equivalent
                            minorToMajorRatio: 0.6,
                            startParam: 0, // Flipped: was 90° to 0°, now 0° to 90°
                            endParam: Math.PI / 2,
                        },
                        labelPos: { x: 280, y: 190 },
                    },
                ];

                const svg = createSVG(450, 340);

                testEllipseArcs.forEach((testCase, index) => {
                    const { ellipse, labelPos, name } = testCase;

                    // Add center point for reference
                    const centerCircle: Circle = {
                        center: ellipse.center,
                        radius: 2,
                    };
                    const centerShape: Shape = {
                        id: `ellipse-center-${index}`,
                        type: GeometryType.CIRCLE,
                        geometry: centerCircle,
                    };
                    svg.addShape(centerShape, '#888', 1);

                    // Original ellipse arc in black (consistent with other tests)
                    const ellipseShape: Shape = {
                        id: `ellipse-arc-${index}`,
                        type: GeometryType.ELLIPSE,
                        geometry: ellipse,
                    };
                    svg.addShape(ellipseShape, 'black', 2);
                    svg.addText(labelPos.x, labelPos.y, name, 'black', '10px');

                    // Outset ellipse arc (+16, consistent offset distance with other tests)
                    const outsetResult = offsetEllipse(
                        ellipse,
                        16,
                        OffsetDirection.OUTSET
                    );
                    if (outsetResult.success) {
                        const outsetGeometry = outsetResult.shapes[0]
                            .geometry as Spline;
                        const outsetShape: Shape = {
                            id: `ellipse-outset-spline-${index}`,
                            type: GeometryType.SPLINE,
                            geometry: outsetGeometry,
                        };
                        svg.addShape(outsetShape, 'red', 1);
                    }

                    // Inset ellipse arc (-16, consistent offset distance with other tests)
                    const insetResult = offsetEllipse(
                        ellipse,
                        16,
                        OffsetDirection.INSET
                    );
                    if (insetResult.success) {
                        const insetGeometry = insetResult.shapes[0]
                            .geometry as Spline;
                        const insetShape: Shape = {
                            id: `ellipse-inset-spline-${index}`,
                            type: GeometryType.SPLINE,
                            geometry: insetGeometry,
                        };
                        svg.addShape(insetShape, 'blue', 1);
                    }
                });

                // Add legend with consistent coloring
                svg.addLegend([
                    { color: 'black', label: 'Original' },
                    { color: 'red', label: 'Outset (+16)' },
                    { color: 'blue', label: 'Inset (-16)' },
                ]);

                writeFileSync(
                    join(outputDir, 'ellipsearc-offsets-ccw-flip.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });
        });

        // Helper function to get label position for a shape
        const _getShapeLabelPosition = (
            shape: Shape,
            yOffset: number = 0
        ): Point2D => {
            switch (shape.type) {
                case 'line':
                    const lineGeom = shape.geometry as Line;
                    return {
                        x: (lineGeom.start.x + lineGeom.end.x) / 2,
                        y: (lineGeom.start.y + lineGeom.end.y) / 2 + yOffset,
                    };
                case 'arc':
                    const arcGeom = shape.geometry as Arc;
                    return {
                        x: arcGeom.center.x,
                        y: arcGeom.center.y + yOffset,
                    };
                case 'circle':
                    const circleGeom = shape.geometry as Circle;
                    return {
                        x: circleGeom.center.x,
                        y: circleGeom.center.y + yOffset,
                    };
                case 'ellipse':
                    const ellipseGeom = shape.geometry as Ellipse;
                    return {
                        x: ellipseGeom.center.x,
                        y: ellipseGeom.center.y + yOffset,
                    };
                case 'polyline':
                    const polyGeom = shape.geometry as Polyline;
                    const points = polylineToPoints(polyGeom);
                    if (points && points.length > 0) {
                        const midIndex = Math.floor(points.length / 2);
                        return {
                            x: points[midIndex].x,
                            y: points[midIndex].y + yOffset,
                        };
                    }
                    break;
                case 'spline':
                    const splineGeom = shape.geometry as Spline;
                    if (
                        splineGeom.controlPoints &&
                        splineGeom.controlPoints.length > 0
                    ) {
                        const midIndex = Math.floor(
                            splineGeom.controlPoints.length / 2
                        );
                        return {
                            x: splineGeom.controlPoints[midIndex].x,
                            y: splineGeom.controlPoints[midIndex].y + yOffset,
                        };
                    }
                    break;
            }
            return { x: 0, y: yOffset };
        };

        describe('Accuracy validation visualization', () => {
            it('should generate SVG showing precision validation', () => {
                // High precision test cases
                const precisionTests = [
                    {
                        name: 'Micro precision',
                        line: {
                            start: { x: 40, y: 120 },
                            end: { x: 360, y: 120 },
                        } as Line,
                        offset: 0.4, // Very small offset
                    },
                    {
                        name: 'Standard precision',
                        line: {
                            start: { x: 40, y: 200 },
                            end: { x: 360, y: 200 },
                        } as Line,
                        offset: 8,
                    },
                    {
                        name: 'Large offset',
                        line: {
                            start: { x: 40, y: 280 },
                            end: { x: 360, y: 280 },
                        } as Line,
                        offset: 32,
                    },
                ];

                const svg = createSVG(400, 400);

                precisionTests.forEach((test, testIdx) => {
                    // Original line
                    const originalShape: Shape = {
                        id: `precision-line-${testIdx}`,
                        type: GeometryType.LINE,
                        geometry: test.line,
                    };
                    svg.addShape(originalShape, 'black', 1);

                    // Offset lines with measurements
                    const result = offsetLine(
                        test.line,
                        test.offset,
                        OffsetDirection.OUTSET
                    );
                    if (result.success) {
                        const offsetGeometry = result.shapes[0]
                            .geometry as Line;
                        const offsetShape: Shape = {
                            id: `precision-offset-${testIdx}`,
                            type: GeometryType.LINE,
                            geometry: offsetGeometry,
                        };
                        svg.addShape(offsetShape, 'red', 1);

                        // Add measurement line showing offset distance
                        const midOriginal = {
                            x: (test.line.start.x + test.line.end.x) / 2,
                            y: (test.line.start.y + test.line.end.y) / 2,
                        };
                        const midOffset = {
                            x:
                                (offsetGeometry.start.x +
                                    offsetGeometry.end.x) /
                                2,
                            y:
                                (offsetGeometry.start.y +
                                    offsetGeometry.end.y) /
                                2,
                        };

                        const measurementLine: Line = {
                            start: midOriginal,
                            end: midOffset,
                        };
                        const measurementShape: Shape = {
                            id: `precision-measurement-${testIdx}`,
                            type: GeometryType.LINE,
                            geometry: measurementLine,
                        };
                        svg.addShape(measurementShape, 'blue', 0.5);
                        svg.addText(
                            midOffset.x + 4,
                            midOffset.y - 4,
                            `${test.offset}`,
                            'blue',
                            '12px'
                        );
                    }
                });

                svg.addLegend([
                    { color: 'black', label: 'Original Lines' },
                    { color: 'red', label: 'Offset Lines' },
                    { color: 'blue', label: 'Measurements' },
                ]);

                writeFileSync(
                    join(outputDir, 'precision-validation.svg'),
                    svg.toString()
                );
                expect(true).toBe(true);
            });
        });

        // Helper functions for SVG generation
        function createSVG(width: number, height: number) {
            return new SVGBuilder(width, height);
        }

        // Note: tessellateEllipse is now imported from the ellipse-tessellation module
    }
);
