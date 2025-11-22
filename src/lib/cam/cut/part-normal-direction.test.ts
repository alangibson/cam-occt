/**
 * Test for Cut Normal Direction on Parts
 *
 * This test validates that cut normals follow deterministic left/right rules:
 * - Shell + CW → left normal
 * - Shell + CCW → right normal
 * - Hole + CW → right normal
 * - Hole + CCW → left normal
 */

import { describe, it, expect } from 'vitest';
import { calculateCutNormal } from './calculate-cut-normal';
import { CutDirection, NormalSide } from './enums';
import type { PartData } from '$lib/cam/part/interfaces';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import { isPointInsidePart } from '$lib/geometry/chain/point-in-chain';
import { GeometryType } from '$lib/geometry/shape/enums';
import { PartType } from '$lib/cam/part/enums';
import { OffsetDirection } from '$lib/cam/offset/types';

describe('Cut Normal Direction on Parts', () => {
    /**
     * This test uses a real-world part where both shell and hole normals
     * were incorrectly pointing into the material.
     */
    it('should have shell normal pointing outward and hole normal pointing inward', () => {
        // Part data from actual bug report
        const part: PartData = {
            id: 'part-7',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 39.022212, y: 17.837954 },
                max: { x: 41.875129, y: 23.987954 },
            },
            shell: {
                id: 'chain-9',
                shapes: [
                    {
                        id: 'shape_1760015737420_2049-split-2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 39.022212, y: 20.9129535 },
                            end: { x: 39.022212, y: 22.48462 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1802',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 39.022212, y: 22.48462 },
                                { x: 39.022212, y: 22.962954 },
                                { x: 39.144643, y: 23.333092 },
                                { x: 39.389504, y: 23.595037 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1803',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 39.389504, y: 23.595037 },
                                { x: 39.634365, y: 23.856981 },
                                { x: 39.987421, y: 23.987954 },
                                { x: 40.448671, y: 23.987954 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1804',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 40.448671, y: 23.987954 },
                                { x: 40.909921, y: 23.987954 },
                                { x: 41.262976, y: 23.856981 },
                                { x: 41.507838, y: 23.595037 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1805',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 41.507838, y: 23.595037 },
                                { x: 41.752699, y: 23.333092 },
                                { x: 41.875129, y: 22.962954 },
                                { x: 41.875129, y: 22.48462 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015737420_2050',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 41.875129, y: 22.48462 },
                            end: { x: 41.875129, y: 19.341287 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1808',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 41.875129, y: 19.341287 },
                                { x: 41.875129, y: 18.862954 },
                                { x: 41.752699, y: 18.492815 },
                                { x: 41.507838, y: 18.23087 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1809',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 41.507838, y: 18.23087 },
                                { x: 41.262976, y: 17.968926 },
                                { x: 40.909921, y: 17.837954 },
                                { x: 40.448671, y: 17.837954 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1783',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 40.448671, y: 17.837954 },
                                { x: 39.987421, y: 17.837954 },
                                { x: 39.634365, y: 17.968926 },
                                { x: 39.389504, y: 18.23087 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1784',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 39.389504, y: 18.23087 },
                                { x: 39.144643, y: 18.492815 },
                                { x: 39.022212, y: 18.862954 },
                                { x: 39.022212, y: 19.341287 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015737420_2049-split-1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 39.022212, y: 19.341287 },
                            end: { x: 39.022212, y: 20.9129535 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            },
            voids: [
                {
                    id: 'hole-7-1',
                    chain: {
                        id: 'chain-11',
                        shapes: [
                            {
                                id: 'shape_1760015737420_2051-split-2',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 40.935546, y: 20.9129535 },
                                    end: { x: 40.935546, y: 22.544412 },
                                },
                                layer: '0',
                            },
                            {
                                id: 'shape_1760015733516_1813',
                                type: GeometryType.SPLINE,
                                geometry: {
                                    controlPoints: [
                                        { x: 40.935546, y: 22.544412 },
                                        { x: 40.935546, y: 22.937329 },
                                        { x: 40.773254, y: 23.133787 },
                                        { x: 40.448671, y: 23.133787 },
                                    ],
                                    knots: [0, 0, 0, 0, 1, 1, 1, 1],
                                    weights: [1, 1, 1, 1],
                                    degree: 3,
                                    fitPoints: [],
                                    closed: false,
                                },
                                layer: '0',
                            },
                            {
                                id: 'shape_1760015733516_1814',
                                type: GeometryType.SPLINE,
                                geometry: {
                                    controlPoints: [
                                        { x: 40.448671, y: 23.133787 },
                                        { x: 40.124087, y: 23.133787 },
                                        { x: 39.961796, y: 22.937329 },
                                        { x: 39.961796, y: 22.544412 },
                                    ],
                                    knots: [0, 0, 0, 0, 1, 1, 1, 1],
                                    weights: [1, 1, 1, 1],
                                    degree: 3,
                                    fitPoints: [],
                                    closed: false,
                                },
                                layer: '0',
                            },
                            {
                                id: 'shape_1760015737420_2052',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 39.961796, y: 22.544412 },
                                    end: { x: 39.961796, y: 19.281495 },
                                },
                                layer: '0',
                            },
                            {
                                id: 'shape_1760015733516_1817',
                                type: GeometryType.SPLINE,
                                geometry: {
                                    controlPoints: [
                                        { x: 39.961796, y: 19.281495 },
                                        { x: 39.961796, y: 18.888579 },
                                        { x: 40.124087, y: 18.69212 },
                                        { x: 40.448671, y: 18.69212 },
                                    ],
                                    knots: [0, 0, 0, 0, 1, 1, 1, 1],
                                    weights: [1, 1, 1, 1],
                                    degree: 3,
                                    fitPoints: [],
                                    closed: false,
                                },
                                layer: '0',
                            },
                            {
                                id: 'shape_1760015733516_1812',
                                type: GeometryType.SPLINE,
                                geometry: {
                                    controlPoints: [
                                        { x: 40.448671, y: 18.69212 },
                                        { x: 40.773254, y: 18.69212 },
                                        { x: 40.935546, y: 18.888579 },
                                        { x: 40.935546, y: 19.281495 },
                                    ],
                                    knots: [0, 0, 0, 0, 1, 1, 1, 1],
                                    weights: [1, 1, 1, 1],
                                    degree: 3,
                                    fitPoints: [],
                                    closed: false,
                                },
                                layer: '0',
                            },
                            {
                                id: 'shape_1760015737420_2051-split-1',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 40.935546, y: 19.281495 },
                                    end: { x: 40.935546, y: 20.9129535 },
                                },
                                layer: '0',
                            },
                        ],
                        clockwise: false,
                    },
                    type: PartType.HOLE,
                    boundingBox: {
                        min: { x: 39.961796, y: 18.69212 },
                        max: { x: 40.935546, y: 23.133787 },
                    },
                },
            ],
            slots: [],
            layerName: '0',
        };

        // Test shell normal
        const shellChain: ChainData = part.shell;
        const shellNormalResult = calculateCutNormal(
            shellChain,
            CutDirection.CLOCKWISE,
            part
        );

        // Debug output
        console.log('Shell chain clockwise:', shellChain.clockwise);
        console.log('Shell normal:', shellNormalResult.normal);
        console.log(
            'Shell connection point:',
            shellNormalResult.connectionPoint
        );

        // Shell normal should point OUTWARD from the part
        // Test by moving along the normal - should move AWAY from solid material
        const testDistance = 5.0;
        const shellTestPoint = {
            x:
                shellNormalResult.connectionPoint.x +
                shellNormalResult.normal.x * testDistance,
            y:
                shellNormalResult.connectionPoint.y +
                shellNormalResult.normal.y * testDistance,
        };

        const shellPointInsidePart = isPointInsidePart(shellTestPoint, part);
        console.log(
            `Shell test point at +${testDistance}:`,
            shellTestPoint,
            'Is inside part:',
            shellPointInsidePart
        );

        const shellNormalPointsOutward = !shellPointInsidePart;
        expect(
            shellNormalPointsOutward,
            `Shell normal should point outward (away from material). ` +
                `Connection point: (${shellNormalResult.connectionPoint.x.toFixed(2)}, ${shellNormalResult.connectionPoint.y.toFixed(2)}), ` +
                `Normal: (${shellNormalResult.normal.x.toFixed(2)}, ${shellNormalResult.normal.y.toFixed(2)}), ` +
                `Test point at +${testDistance}: (${shellTestPoint.x.toFixed(2)}, ${shellTestPoint.y.toFixed(2)}), ` +
                `Is inside part: ${shellPointInsidePart}`
        ).toBe(true);

        // Test hole normal
        const holeChain: ChainData = part.voids[0].chain;
        const holeNormalResult = calculateCutNormal(
            holeChain,
            CutDirection.COUNTERCLOCKWISE,
            part
        );

        // Debug output
        console.log('Hole chain clockwise:', holeChain.clockwise);
        console.log('Hole normal:', holeNormalResult.normal);
        console.log('Hole connection point:', holeNormalResult.connectionPoint);

        // Hole normal should point INWARD toward the hole (away from material)
        // Test by moving along the normal - should move AWAY from solid material
        const holeTestPoint = {
            x:
                holeNormalResult.connectionPoint.x +
                holeNormalResult.normal.x * testDistance,
            y:
                holeNormalResult.connectionPoint.y +
                holeNormalResult.normal.y * testDistance,
        };

        const holePointInsidePart = isPointInsidePart(holeTestPoint, part);
        console.log(
            `Hole test point at +${testDistance}:`,
            holeTestPoint,
            'Is inside part:',
            holePointInsidePart
        );

        const holeNormalPointsInward = !holePointInsidePart;
        expect(
            holeNormalPointsInward,
            `Hole normal should point inward toward hole (away from material). ` +
                `Connection point: (${holeNormalResult.connectionPoint.x.toFixed(2)}, ${holeNormalResult.connectionPoint.y.toFixed(2)}), ` +
                `Normal: (${holeNormalResult.normal.x.toFixed(2)}, ${holeNormalResult.normal.y.toFixed(2)}), ` +
                `Test point at +${testDistance}: (${holeTestPoint.x.toFixed(2)}, ${holeTestPoint.y.toFixed(2)}), ` +
                `Is inside part: ${holePointInsidePart}`
        ).toBe(true);
    });

    /**
     * Test with cutChain (as created by createCutChain function)
     * This simulates the actual flow through operation/cut generation
     */
    it('should have correct normals when using cutChains without clockwise property', () => {
        // Part data (same as above)
        const part: PartData = {
            id: 'part-7',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 39.022212, y: 17.837954 },
                max: { x: 41.875129, y: 23.987954 },
            },
            shell: {
                id: 'chain-9',
                shapes: [
                    {
                        id: 'shape_1760015737420_2049-split-2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 39.022212, y: 20.9129535 },
                            end: { x: 39.022212, y: 22.48462 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1802',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 39.022212, y: 22.48462 },
                                { x: 39.022212, y: 22.962954 },
                                { x: 39.144643, y: 23.333092 },
                                { x: 39.389504, y: 23.595037 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1803',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 39.389504, y: 23.595037 },
                                { x: 39.634365, y: 23.856981 },
                                { x: 39.987421, y: 23.987954 },
                                { x: 40.448671, y: 23.987954 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1804',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 40.448671, y: 23.987954 },
                                { x: 40.909921, y: 23.987954 },
                                { x: 41.262976, y: 23.856981 },
                                { x: 41.507838, y: 23.595037 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1805',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 41.507838, y: 23.595037 },
                                { x: 41.752699, y: 23.333092 },
                                { x: 41.875129, y: 22.962954 },
                                { x: 41.875129, y: 22.48462 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015737420_2050',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 41.875129, y: 22.48462 },
                            end: { x: 41.875129, y: 19.341287 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1808',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 41.875129, y: 19.341287 },
                                { x: 41.875129, y: 18.862954 },
                                { x: 41.752699, y: 18.492815 },
                                { x: 41.507838, y: 18.23087 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1809',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 41.507838, y: 18.23087 },
                                { x: 41.262976, y: 17.968926 },
                                { x: 40.909921, y: 17.837954 },
                                { x: 40.448671, y: 17.837954 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1783',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 40.448671, y: 17.837954 },
                                { x: 39.987421, y: 17.837954 },
                                { x: 39.634365, y: 17.968926 },
                                { x: 39.389504, y: 18.23087 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015733516_1784',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 39.389504, y: 18.23087 },
                                { x: 39.144643, y: 18.492815 },
                                { x: 39.022212, y: 18.862954 },
                                { x: 39.022212, y: 19.341287 },
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer: '0',
                    },
                    {
                        id: 'shape_1760015737420_2049-split-1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 39.022212, y: 19.341287 },
                            end: { x: 39.022212, y: 20.9129535 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            },
            voids: [],
            slots: [],
            layerName: '0',
        };

        // Create shell cutChain WITHOUT clockwise property (as createCutChain does)
        const shellCutChain: ChainData = {
            id: 'chain-9-cut',
            shapes: [...part.shell.shapes], // Copy shapes
            // NOTE: No clockwise property!
        };

        // Calculate normal with cutChain that has no clockwise property
        const shellNormalResult = calculateCutNormal(
            shellCutChain,
            CutDirection.CLOCKWISE,
            part
        );

        console.log(
            'Shell cutChain clockwise (should be undefined):',
            shellCutChain.clockwise
        );
        console.log('Shell normal from cutChain:', shellNormalResult.normal);

        // Test that shell normal points outward
        const testDistance = 5.0;
        const shellTestPoint = {
            x:
                shellNormalResult.connectionPoint.x +
                shellNormalResult.normal.x * testDistance,
            y:
                shellNormalResult.connectionPoint.y +
                shellNormalResult.normal.y * testDistance,
        };

        const shellPointInsidePart = isPointInsidePart(shellTestPoint, part);
        console.log(
            'Shell test point is inside part:',
            shellPointInsidePart,
            '(should be false for outward normal)'
        );

        expect(
            !shellPointInsidePart,
            `Shell normal should point outward even when cutChain has no clockwise property`
        ).toBe(true);
    });

    /**
     * Test that deterministic left/right rules are applied correctly
     */
    it('should apply left/right normal rules based on cut direction', () => {
        // Simplified part for focused testing
        const part: PartData = {
            id: 'part-test',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            },
            shell: {
                id: 'chain-test',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 10, y: 10 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 10 },
                            end: { x: 0, y: 10 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 10 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true, // Clockwise winding
            },
            voids: [],
            slots: [],
            layerName: '0',
        };

        // Test with CLOCKWISE cut direction on shell
        // Start point (0,0), tangent (1,0)
        // leftNormal = (0,1), rightNormal = (0,-1)
        // Shell + CW should give leftNormal
        const normalCW = calculateCutNormal(
            part.shell,
            CutDirection.CLOCKWISE,
            part
        );

        expect(normalCW.normal.x).toBeCloseTo(0);
        expect(normalCW.normal.y).toBeCloseTo(1);
        expect(normalCW.connectionPoint.x).toBe(0);
        expect(normalCW.connectionPoint.y).toBe(0);

        // Test with COUNTERCLOCKWISE cut direction on shell
        // Shell + CCW should give rightNormal
        const normalCCW = calculateCutNormal(
            part.shell,
            CutDirection.COUNTERCLOCKWISE,
            part
        );

        expect(normalCCW.normal.x).toBeCloseTo(0);
        expect(normalCCW.normal.y).toBeCloseTo(-1);
        expect(normalCCW.connectionPoint.x).toBe(0);
        expect(normalCCW.connectionPoint.y).toBe(0);
    });

    /**
     * Test that originalChainId allows proper shell/hole identification
     */
    it('should use originalChainId to identify shell vs hole', () => {
        // Simple rectangular part
        const part: PartData = {
            id: 'part-bug',
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            shell: {
                id: 'chain-original', // Original chain ID
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 10, y: 10 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 10 },
                            end: { x: 0, y: 10 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 10 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            },
            voids: [],
            slots: [],
            layerName: '0',
        };

        // Create cutChain WITHOUT originalChainId
        // This will NOT be identified as a shell (bug case)
        const cutChainBroken: ChainData = {
            id: 'chain-original-cut', // Different ID!
            shapes: [...part.shell.shapes],
            // No originalChainId set!
        };

        const normalBroken = calculateCutNormal(
            cutChainBroken,
            CutDirection.CLOCKWISE,
            part
        );

        // Without originalChainId, isChainShellInPart returns false
        // So it's treated as a hole: Hole + CW → rightNormal = (0, -1)
        expect(normalBroken.normal.x).toBeCloseTo(0);
        expect(normalBroken.normal.y).toBeCloseTo(-1);

        // Create cutChain WITH originalChainId (correct case)
        const cutChainFixed: ChainData = {
            id: 'chain-original-cut',
            shapes: [...part.shell.shapes],
            originalChainId: part.shell.id, // Set originalChainId!
        };

        const normalFixed = calculateCutNormal(
            cutChainFixed,
            CutDirection.CLOCKWISE,
            part
        );

        // With originalChainId, isChainShellInPart returns true
        // So it's treated as a shell: Shell + CW → leftNormal = (0, 1)
        expect(normalFixed.normal.x).toBeCloseTo(0);
        expect(normalFixed.normal.y).toBeCloseTo(1);

        // The two normals should be different (demonstrating the fix)
        expect(normalBroken.normal.y).not.toBeCloseTo(normalFixed.normal.y);
    });

    /**
     * Test that INNER kerf compensation flips shell normal
     */
    it('should flip shell normal when INNER kerf compensation is applied', () => {
        // Simple rectangular shell
        const part: PartData = {
            id: 'part-test',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            },
            shell: {
                id: 'chain-test',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 10, y: 10 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 10 },
                            end: { x: 0, y: 10 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 10 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            },
            voids: [],
            slots: [],
            layerName: '0',
        };

        // Test shell without INNER kerf (normal case)
        // Start point (0,0), tangent (1,0)
        // Shell + CW → left normal (0,1) pointing up/outward
        const normalNoKerf = calculateCutNormal(
            part.shell,
            CutDirection.CLOCKWISE,
            part
        );
        expect(normalNoKerf.normal.x).toBeCloseTo(0);
        expect(normalNoKerf.normal.y).toBeCloseTo(1); // Points outward (up)
        expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);

        // Test shell with INNER kerf (should flip)
        // Shell + CW + INNER → right normal (0,-1) pointing down/inward
        const normalWithInnerKerf = calculateCutNormal(
            part.shell,
            CutDirection.CLOCKWISE,
            part,
            OffsetDirection.INSET
        );
        expect(normalWithInnerKerf.normal.x).toBeCloseTo(0);
        expect(normalWithInnerKerf.normal.y).toBeCloseTo(-1); // Points inward (down)
        expect(normalWithInnerKerf.normalSide).toBe(NormalSide.RIGHT);

        // Verify they are flipped
        expect(normalNoKerf.normal.y).toBeCloseTo(
            -normalWithInnerKerf.normal.y
        );
    });

    /**
     * Test that OUTER kerf compensation flips hole normal
     */
    it('should flip hole normal when OUTER kerf compensation is applied', () => {
        // Simple rectangular part with hole
        const part: PartData = {
            id: 'part-test',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 0, y: 0 },
                max: { x: 20, y: 20 },
            },
            shell: {
                id: 'chain-shell',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 20, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 20, y: 0 },
                            end: { x: 20, y: 20 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 20, y: 20 },
                            end: { x: 0, y: 20 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 20 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            },
            voids: [
                {
                    id: 'hole-1',
                    chain: {
                        id: 'chain-hole',
                        shapes: [
                            {
                                id: 'hole-line1',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 5, y: 5 },
                                    end: { x: 15, y: 5 },
                                },
                                layer: '0',
                            },
                            {
                                id: 'hole-line2',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 15, y: 5 },
                                    end: { x: 15, y: 15 },
                                },
                                layer: '0',
                            },
                            {
                                id: 'hole-line3',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 15, y: 15 },
                                    end: { x: 5, y: 15 },
                                },
                                layer: '0',
                            },
                            {
                                id: 'hole-line4',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 5, y: 15 },
                                    end: { x: 5, y: 5 },
                                },
                                layer: '0',
                            },
                        ],
                        clockwise: false,
                    },
                    type: PartType.HOLE,
                    boundingBox: {
                        min: { x: 5, y: 5 },
                        max: { x: 15, y: 15 },
                    },
                },
            ],
            slots: [],
            layerName: '0',
        };

        const holeChain = part.voids[0].chain;

        // Test hole without OUTER kerf (normal case)
        // Start point (5,5), tangent (1,0)
        // Hole + CCW → left normal (0,1) pointing up/inward
        const normalNoKerf = calculateCutNormal(
            holeChain,
            CutDirection.COUNTERCLOCKWISE,
            part
        );
        expect(normalNoKerf.normal.x).toBeCloseTo(0);
        expect(normalNoKerf.normal.y).toBeCloseTo(1); // Points inward (up)
        expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);

        // Test hole with OUTER kerf (should flip)
        // Hole + CCW + OUTER → right normal (0,-1) pointing down/outward
        const normalWithOuterKerf = calculateCutNormal(
            holeChain,
            CutDirection.COUNTERCLOCKWISE,
            part,
            OffsetDirection.OUTSET
        );
        expect(normalWithOuterKerf.normal.x).toBeCloseTo(0);
        expect(normalWithOuterKerf.normal.y).toBeCloseTo(-1); // Points outward (down)
        expect(normalWithOuterKerf.normalSide).toBe(NormalSide.RIGHT);

        // Verify they are flipped
        expect(normalNoKerf.normal.y).toBeCloseTo(
            -normalWithOuterKerf.normal.y
        );
    });
});
