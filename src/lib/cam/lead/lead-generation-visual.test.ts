import { mkdirSync, writeFileSync } from 'fs';
import { describe, it } from 'vitest';
import { SVGBuilder } from '$lib/test/svg-builder';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { Spline } from '$lib/geometry/spline/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { isArc } from '$lib/geometry/arc/functions';
import { isLine } from '$lib/geometry/line/functions';
import {
    getChainStartPoint,
    getChainEndPoint,
    getChainTangent,
} from '$lib/cam/chain/functions';
import { Chain } from '$lib/cam/chain/classes';

describe('Lead Generation Visual Test with Specific Spline', () => {
    it('should generate SVG with spline and colored lead arcs', async () => {
        const outputDir = 'tests/output/visual/leads';
        mkdirSync(outputDir, { recursive: true });

        // Create the first spline (positioned so leftmost lead point is ~40 from edge)
        const spline1: Spline = {
            controlPoints: [
                { x: -27.0, y: 750.0 },
                { x: -27.0, y: 714.3 },
                { x: -46.0, y: 681.2 },
                { x: -77.0, y: 663.4 },
            ],
            knots: [0, 0, 0, 0, 1, 1, 1, 1], // 8 knots for degree 3, 4 control points
            weights: [1, 1, 1, 1], // 4 weights
            degree: 3,
            fitPoints: [],
            closed: false,
        };

        // Create the second separate spline (5x longer, origin fixed)
        const spline2: Spline = {
            controlPoints: [
                { x: 55.0, y: 83.66 }, // origin stays the same
                { x: 55.0 + (58.1 - 55.0) * 5, y: 83.66 + (81.88 - 83.66) * 5 }, // 70.5, 74.76
                { x: 55.0 + (60.0 - 55.0) * 5, y: 83.66 + (78.57 - 83.66) * 5 }, // 80.0, 58.21
                { x: 55.0 + (60.0 - 55.0) * 5, y: 83.66 + (75.0 - 83.66) * 5 }, // 80.0, 40.36
            ],
            knots: [0, 0, 0, 0, 1, 1, 1, 1], // 8 knots for degree 3, 4 control points
            weights: [1, 1, 1, 1], // 4 weights
            degree: 3,
            fitPoints: [],
            closed: false,
        };

        // Create shapes from both splines
        const splineShape1: ShapeData = {
            id: 'test-spline-1',
            type: GeometryType.SPLINE,
            geometry: spline1,
        };

        const splineShape2: ShapeData = {
            id: 'test-spline-2',
            type: GeometryType.SPLINE,
            geometry: spline2,
        };

        // Create chains for both splines (for lead calculation)
        const chain1: ChainData = {
            id: 'test-chain-1',
            name: 'test-chain-1', shapes: [splineShape1],
            clockwise: null, // null indicates open chain
        };

        const chain2: ChainData = {
            id: 'test-chain-2',
            name: 'test-chain-2', shapes: [splineShape2],
            clockwise: null, // null indicates open chain
        };

        // Configure lead-in and lead-out with arc leads (lead length halved)
        const leadInConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 37.5, // 75.0 / 2 = 37.5
            flipSide: false,
            fit: false,
        };

        const leadOutConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 37.5, // 75.0 / 2 = 37.5
            flipSide: false,
            fit: false,
        };

        // Calculate leads for both spline chains
        const cutNormal: Point2D = { x: 1, y: 0 };
        const leadResult1 = calculateLeads(
            new Chain(chain1),
            leadInConfig,
            leadOutConfig,
            CutDirection.CLOCKWISE,
            undefined,
            cutNormal
        );

        const leadResult2 = calculateLeads(
            new Chain(chain2),
            leadInConfig,
            leadOutConfig,
            CutDirection.CLOCKWISE,
            undefined,
            cutNormal
        );

        // Create SVG builder
        const svg = new SVGBuilder();

        // Add legend
        svg.addLegend([
            { color: 'black', label: 'Spline Path' },
            { color: 'blue', label: 'Lead In Arc' },
            { color: 'red', label: 'Lead Out Arc' },
            { color: 'yellow', label: 'Spline Tangents' },
            { color: 'green', label: 'Start Point' },
            { color: 'orange', label: 'End Point' },
        ]);

        // Add both splines in black
        svg.addShape(splineShape1, 'black', 2.0);
        svg.addShape(splineShape2, 'black', 2.0);

        // Add spline tangent lines at lead connection points for both chains
        // Chain 1 tangents and markers
        const startPoint1 = getChainStartPoint(new Chain(chain1));
        const endPoint1 = getChainEndPoint(new Chain(chain1));

        if (startPoint1) {
            svg.addIntersectionPoint(startPoint1, 'green', 3);
            const startTangent1 = getChainTangent(
                new Chain(chain1),
                startPoint1,
                true
            );
            const tangentLength = 30;
            const tangentStart = {
                x: startPoint1.x - startTangent1.x * tangentLength,
                y: startPoint1.y - startTangent1.y * tangentLength,
            };
            const tangentEnd = {
                x: startPoint1.x + startTangent1.x * tangentLength,
                y: startPoint1.y + startTangent1.y * tangentLength,
            };
            svg.addLine(
                { start: tangentStart, end: tangentEnd },
                'yellow',
                2.0
            );
        }

        if (endPoint1) {
            svg.addIntersectionPoint(endPoint1, 'orange', 3);
            const endTangent1 = getChainTangent(
                new Chain(chain1),
                endPoint1,
                false
            );
            const tangentLength = 30;
            const tangentStart = {
                x: endPoint1.x - endTangent1.x * tangentLength,
                y: endPoint1.y - endTangent1.y * tangentLength,
            };
            const tangentEnd = {
                x: endPoint1.x + endTangent1.x * tangentLength,
                y: endPoint1.y + endTangent1.y * tangentLength,
            };
            svg.addLine(
                { start: tangentStart, end: tangentEnd },
                'yellow',
                2.0
            );
        }

        // Chain 2 tangents and markers
        const startPoint2 = getChainStartPoint(new Chain(chain2));
        const endPoint2 = getChainEndPoint(new Chain(chain2));

        if (startPoint2) {
            svg.addIntersectionPoint(startPoint2, 'green', 3);
            const startTangent2 = getChainTangent(
                new Chain(chain2),
                startPoint2,
                true
            );
            const tangentLength = 30;
            const tangentStart = {
                x: startPoint2.x - startTangent2.x * tangentLength,
                y: startPoint2.y - startTangent2.y * tangentLength,
            };
            const tangentEnd = {
                x: startPoint2.x + startTangent2.x * tangentLength,
                y: startPoint2.y + startTangent2.y * tangentLength,
            };
            svg.addLine(
                { start: tangentStart, end: tangentEnd },
                'yellow',
                2.0
            );
        }

        if (endPoint2) {
            svg.addIntersectionPoint(endPoint2, 'orange', 3);
            const endTangent2 = getChainTangent(
                new Chain(chain2),
                endPoint2,
                false
            );
            const tangentLength = 30;
            const tangentStart = {
                x: endPoint2.x - endTangent2.x * tangentLength,
                y: endPoint2.y - endTangent2.y * tangentLength,
            };
            const tangentEnd = {
                x: endPoint2.x + endTangent2.x * tangentLength,
                y: endPoint2.y + endTangent2.y * tangentLength,
            };
            svg.addLine(
                { start: tangentStart, end: tangentEnd },
                'yellow',
                2.0
            );
        }

        // Add leads for first spline
        if (leadResult1.leadIn && leadResult1.leadIn.geometry) {
            const leadInGeometry = leadResult1.leadIn.geometry;
            if (isArc(leadInGeometry)) {
                const leadInShape: ShapeData = {
                    id: 'lead-in-arc-1',
                    type: GeometryType.ARC,
                    geometry: leadInGeometry,
                };
                svg.addShape(leadInShape, 'blue', 3.0);
            } else if (isLine(leadInGeometry)) {
                svg.addLine(leadInGeometry, 'blue', 3.0);
            }
        }

        if (leadResult1.leadOut && leadResult1.leadOut.geometry) {
            const leadOutGeometry = leadResult1.leadOut.geometry;
            if (isArc(leadOutGeometry)) {
                const leadOutShape: ShapeData = {
                    id: 'lead-out-arc-1',
                    type: GeometryType.ARC,
                    geometry: leadOutGeometry,
                };
                svg.addShape(leadOutShape, 'red', 3.0);
            } else if (isLine(leadOutGeometry)) {
                svg.addLine(leadOutGeometry, 'red', 3.0);
            }
        }

        // Add leads for second spline
        if (leadResult2.leadIn && leadResult2.leadIn.geometry) {
            const leadInGeometry = leadResult2.leadIn.geometry;
            if (isArc(leadInGeometry)) {
                const leadInShape: ShapeData = {
                    id: 'lead-in-arc-2',
                    type: GeometryType.ARC,
                    geometry: leadInGeometry,
                };
                svg.addShape(leadInShape, 'blue', 3.0);
            } else if (isLine(leadInGeometry)) {
                svg.addLine(leadInGeometry, 'blue', 3.0);
            }
        }

        if (leadResult2.leadOut && leadResult2.leadOut.geometry) {
            const leadOutGeometry = leadResult2.leadOut.geometry;
            if (isArc(leadOutGeometry)) {
                const leadOutShape: ShapeData = {
                    id: 'lead-out-arc-2',
                    type: GeometryType.ARC,
                    geometry: leadOutGeometry,
                };
                svg.addShape(leadOutShape, 'red', 3.0);
            } else if (isLine(leadOutGeometry)) {
                svg.addLine(leadOutGeometry, 'red', 3.0);
            }
        }

        svg.addTitle('Spline with Blue Lead In and Red Lead Out Arcs');

        // Write the SVG file
        const filename = `${outputDir}/spline-with-lead-arcs.svg`;
        writeFileSync(filename, svg.toString());

        // Log information about the leads generated
        console.log('Lead generation results:');
        console.log('Spline 1:');
        if (leadResult1.leadIn) {
            console.log(
                `  Lead-in type: ${leadResult1.leadIn.geometry ? (isArc(leadResult1.leadIn.geometry) ? 'Arc' : 'Line') : 'None'}`
            );
        }
        if (leadResult1.leadOut) {
            console.log(
                `  Lead-out type: ${leadResult1.leadOut.geometry ? (isArc(leadResult1.leadOut.geometry) ? 'Arc' : 'Line') : 'None'}`
            );
        }
        if (leadResult1.warnings && leadResult1.warnings.length > 0) {
            console.log('  Warnings:', leadResult1.warnings);
        }

        console.log('Spline 2:');
        if (leadResult2.leadIn) {
            console.log(
                `  Lead-in type: ${leadResult2.leadIn.geometry ? (isArc(leadResult2.leadIn.geometry) ? 'Arc' : 'Line') : 'None'}`
            );
        }
        if (leadResult2.leadOut) {
            console.log(
                `  Lead-out type: ${leadResult2.leadOut.geometry ? (isArc(leadResult2.leadOut.geometry) ? 'Arc' : 'Line') : 'None'}`
            );
        }
        if (leadResult2.warnings && leadResult2.warnings.length > 0) {
            console.log('  Warnings:', leadResult2.warnings);
        }
    });
});
