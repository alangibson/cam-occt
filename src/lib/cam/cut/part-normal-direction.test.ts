import { Chain } from '$lib/cam/chain/classes.svelte';
import { Part } from '$lib/cam/part/classes.svelte';
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
import type { ChainData } from '$lib/cam/chain/interfaces';
import { isPointInsidePart } from '$lib/cam/chain/point-in-chain';
import { GeometryType } from '$lib/geometry/enums';
import { PartType } from '$lib/cam/part/enums';
import { OffsetDirection } from '$lib/cam/offset/types';
import { createCutChain } from '$lib/cam/chain/functions';
import { optimizeChainStartPoint } from '$lib/algorithms/optimize-start-points/optimize-start-points';

describe('Cut Normal Direction on Parts', () => {
    /**
     * This test uses a real-world part where both shell and hole normals
     * were incorrectly pointing into the material.
     */
    it('should have shell normal pointing outward and hole normal pointing inward', () => {
        // Part data from actual bug report
        const part: PartData = {
            id: 'part-7',
            name: 'part-7',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 39.022212, y: 17.837954 },
                max: { x: 41.875129, y: 23.987954 },
            },
            shell: {
                id: 'chain-9',
                name: 'chain-9',
                shapes: [
                    {
                        id: '1760015737420_2049-split-2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 39.022212, y: 20.9129535 },
                            end: { x: 39.022212, y: 22.48462 },
                        },
                        layer: '0',
                    },
                    {
                        id: '1760015733516_1802',
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
                        id: '1760015733516_1803',
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
                        id: '1760015733516_1804',
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
                        id: '1760015733516_1805',
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
                        id: '1760015737420_2050',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 41.875129, y: 22.48462 },
                            end: { x: 41.875129, y: 19.341287 },
                        },
                        layer: '0',
                    },
                    {
                        id: '1760015733516_1808',
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
                        id: '1760015733516_1809',
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
                        id: '1760015733516_1783',
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
                        id: '1760015733516_1784',
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
                        id: '1760015737420_2049-split-1',
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
                        name: 'chain-11',
                        shapes: [
                            {
                                id: '1760015737420_2051-split-2',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 40.935546, y: 20.9129535 },
                                    end: { x: 40.935546, y: 22.544412 },
                                },
                                layer: '0',
                            },
                            {
                                id: '1760015733516_1813',
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
                                id: '1760015733516_1814',
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
                                id: '1760015737420_2052',
                                type: GeometryType.LINE,
                                geometry: {
                                    start: { x: 39.961796, y: 22.544412 },
                                    end: { x: 39.961796, y: 19.281495 },
                                },
                                layer: '0',
                            },
                            {
                                id: '1760015733516_1817',
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
                                id: '1760015733516_1812',
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
                                id: '1760015737420_2051-split-1',
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
            new Chain(shellChain),
            CutDirection.CLOCKWISE,
            new Part(part)
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

        const shellPointInsidePart = isPointInsidePart(shellTestPoint, {
            shell: new Chain(part.shell),
            voids: part.voids.map((v) => ({ chain: new Chain(v.chain) })),
        });
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
            new Chain(holeChain),
            CutDirection.COUNTERCLOCKWISE,
            new Part(part)
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

        const holePointInsidePart = isPointInsidePart(holeTestPoint, {
            shell: new Chain(part.shell),
            voids: part.voids.map((v) => ({ chain: new Chain(v.chain) })),
        });
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
            name: 'part-7',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 39.022212, y: 17.837954 },
                max: { x: 41.875129, y: 23.987954 },
            },
            shell: {
                id: 'chain-9',
                name: 'chain-9',
                shapes: [
                    {
                        id: '1760015737420_2049-split-2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 39.022212, y: 20.9129535 },
                            end: { x: 39.022212, y: 22.48462 },
                        },
                        layer: '0',
                    },
                    {
                        id: '1760015733516_1802',
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
                        id: '1760015733516_1803',
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
                        id: '1760015733516_1804',
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
                        id: '1760015733516_1805',
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
                        id: '1760015737420_2050',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 41.875129, y: 22.48462 },
                            end: { x: 41.875129, y: 19.341287 },
                        },
                        layer: '0',
                    },
                    {
                        id: '1760015733516_1808',
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
                        id: '1760015733516_1809',
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
                        id: '1760015733516_1783',
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
                        id: '1760015733516_1784',
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
                        id: '1760015737420_2049-split-1',
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
            name: 'chain-9-cut',
            shapes: [...part.shell.shapes], // Copy shapes
            // NOTE: No clockwise property!
        };

        // Calculate normal with cutChain that has no clockwise property
        const shellNormalResult = calculateCutNormal(
            new Chain(shellCutChain),
            CutDirection.CLOCKWISE,
            new Part(part)
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

        const shellPointInsidePart = isPointInsidePart(shellTestPoint, {
            shell: new Chain(part.shell),
            voids: part.voids.map((v) => ({ chain: new Chain(v.chain) })),
        });
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
            name: 'part-test',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            },
            shell: {
                id: 'chain-test',
                name: 'chain-test',
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
            new Chain(part.shell),
            CutDirection.CLOCKWISE,
            new Part(part)
        );

        expect(normalCW.normal.x).toBeCloseTo(0);
        expect(normalCW.normal.y).toBeCloseTo(1);
        expect(normalCW.connectionPoint.x).toBe(0);
        expect(normalCW.connectionPoint.y).toBe(0);

        // Test with COUNTERCLOCKWISE cut direction on shell
        // Shell + CCW should give rightNormal
        const normalCCW = calculateCutNormal(
            new Chain(part.shell),
            CutDirection.COUNTERCLOCKWISE,
            new Part(part)
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
            name: 'part-bug',
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            shell: {
                id: 'chain-original', // Original chain ID
                name: 'chain-original',
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
            name: 'chain-original-cut',
            shapes: [...part.shell.shapes],
            // No originalChainId set!
        };

        const normalBroken = calculateCutNormal(
            new Chain(cutChainBroken),
            CutDirection.CLOCKWISE,
            new Part(part)
        );

        // Without originalChainId, isChainShellInPart returns false
        // So it's treated as a hole: Hole + CW → rightNormal = (0, -1)
        expect(normalBroken.normal.x).toBeCloseTo(0);
        expect(normalBroken.normal.y).toBeCloseTo(-1);

        // Create cutChain WITH originalChainId (correct case)
        const cutChainFixed: ChainData = {
            id: 'chain-original-cut',
            name: 'chain-original-cut',
            shapes: [...part.shell.shapes],
            originalChainId: part.shell.id, // Set originalChainId!
        };

        const normalFixed = calculateCutNormal(
            new Chain(cutChainFixed),
            CutDirection.CLOCKWISE,
            new Part(part)
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
            name: 'part-test',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 0, y: 0 },
                max: { x: 10, y: 10 },
            },
            shell: {
                id: 'chain-test',
                name: 'chain-test',
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
            new Chain(part.shell),
            CutDirection.CLOCKWISE,
            new Part(part)
        );
        expect(normalNoKerf.normal.x).toBeCloseTo(0);
        expect(normalNoKerf.normal.y).toBeCloseTo(1); // Points outward (up)
        expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);

        // Test shell with INNER kerf (should flip)
        // Shell + CW + INNER → right normal (0,-1) pointing down/inward
        const normalWithInnerKerf = calculateCutNormal(
            new Chain(part.shell),
            CutDirection.CLOCKWISE,
            new Part(part),
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
            name: 'part-test',
            type: PartType.SHELL,
            boundingBox: {
                min: { x: 0, y: 0 },
                max: { x: 20, y: 20 },
            },
            shell: {
                id: 'chain-shell',
                name: 'chain-shell',
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
                        name: 'chain-hole',
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
            new Chain(holeChain),
            CutDirection.COUNTERCLOCKWISE,
            new Part(part)
        );
        expect(normalNoKerf.normal.x).toBeCloseTo(0);
        expect(normalNoKerf.normal.y).toBeCloseTo(1); // Points inward (up)
        expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);

        // Test hole with OUTER kerf (should flip)
        // Hole + CCW + OUTER → right normal (0,-1) pointing down/outward
        const normalWithOuterKerf = calculateCutNormal(
            new Chain(holeChain),
            CutDirection.COUNTERCLOCKWISE,
            new Part(part),
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

    /**
     * Test that cut normals remain correct after start point optimization
     * This is the main bug fix: optimization was losing originalChainId
     */
    describe('Cut Normals After Start Point Optimization', () => {
        it('should preserve originalChainId after optimization', () => {
            // Create a simple square chain
            const originalChain = new Chain({
                id: 'chain-original',
                name: 'Original Chain',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 100 },
                            end: { x: 0, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 100 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            });

            // Optimize the chain
            const result = optimizeChainStartPoint(originalChain, {
                tolerance: 0.001,
                splitPosition: 'midpoint',
            });

            // Verify optimization occurred
            expect(result.modified).toBe(true);
            expect(result.optimizedChain).toBeTruthy();

            // Verify originalChainId is preserved
            expect(result.optimizedChain!.originalChainId).toBe(
                originalChain.originalChainId
            );
            expect(result.optimizedChain!.clockwise).toBe(
                originalChain.clockwise
            );
        });

        it('should have correct shell normal after optimization', () => {
            // Simple rectangular part
            const part: PartData = {
                id: 'part-test',
                name: 'part-test',
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                shell: {
                    id: 'chain-shell',
                    name: 'Shell Chain',
                    shapes: [
                        {
                            id: 'line1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 100, y: 0 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 100, y: 0 },
                                end: { x: 100, y: 100 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 100, y: 100 },
                                end: { x: 0, y: 100 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 100 },
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

            // Create cut chain (this sets originalChainId)
            const shellChain = new Chain(part.shell);
            const cutChainResult = createCutChain(
                shellChain,
                CutDirection.CLOCKWISE,
                undefined
            );
            const cutChain = cutChainResult.cutChain;

            // Verify originalChainId is set
            expect(cutChain.originalChainId).toBe(part.shell.id);

            // Calculate normal BEFORE optimization
            const normalBefore = calculateCutNormal(
                cutChain,
                CutDirection.CLOCKWISE,
                new Part(part)
            );

            // Optimize the cut chain
            const optimizeResult = optimizeChainStartPoint(cutChain, {
                tolerance: 0.001,
                splitPosition: 'midpoint',
            });

            expect(optimizeResult.modified).toBe(true);
            const optimizedChain = optimizeResult.optimizedChain!;

            // Verify originalChainId is preserved after optimization
            expect(optimizedChain.originalChainId).toBe(part.shell.id);

            // Calculate normal AFTER optimization
            const normalAfter = calculateCutNormal(
                optimizedChain,
                CutDirection.CLOCKWISE,
                new Part(part)
            );

            // Both normals should point outward (same direction)
            // The start point may have changed, so we can't compare the exact normal vector
            // But we can verify both are correctly identified as shell (LEFT side)
            expect(normalBefore.normalSide).toBe(NormalSide.LEFT);
            expect(normalAfter.normalSide).toBe(NormalSide.LEFT);
        });

        it('should have correct hole normal after optimization', () => {
            // Part with a hole
            const part: PartData = {
                id: 'part-test',
                name: 'part-test',
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 200, y: 200 } },
                shell: {
                    id: 'chain-shell',
                    name: 'Shell',
                    shapes: [
                        {
                            id: 'line1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 200, y: 0 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 200, y: 0 },
                                end: { x: 200, y: 200 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 200, y: 200 },
                                end: { x: 0, y: 200 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 200 },
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
                            name: 'Hole',
                            shapes: [
                                {
                                    id: 'hole-line1',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 50, y: 50 },
                                        end: { x: 150, y: 50 },
                                    },
                                    layer: '0',
                                },
                                {
                                    id: 'hole-line2',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 150, y: 50 },
                                        end: { x: 150, y: 150 },
                                    },
                                    layer: '0',
                                },
                                {
                                    id: 'hole-line3',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 150, y: 150 },
                                        end: { x: 50, y: 150 },
                                    },
                                    layer: '0',
                                },
                                {
                                    id: 'hole-line4',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 50, y: 150 },
                                        end: { x: 50, y: 50 },
                                    },
                                    layer: '0',
                                },
                            ],
                            clockwise: false,
                        },
                        type: PartType.HOLE,
                        boundingBox: {
                            min: { x: 50, y: 50 },
                            max: { x: 150, y: 150 },
                        },
                    },
                ],
                slots: [],
                layerName: '0',
            };

            // Create cut chain for hole
            const holeChain = new Chain(part.voids[0].chain);
            const cutChainResult = createCutChain(
                holeChain,
                CutDirection.COUNTERCLOCKWISE,
                undefined
            );
            const cutChain = cutChainResult.cutChain;

            // Verify originalChainId is set
            expect(cutChain.originalChainId).toBe(part.voids[0].chain.id);

            // Calculate normal BEFORE optimization
            const normalBefore = calculateCutNormal(
                cutChain,
                CutDirection.COUNTERCLOCKWISE,
                new Part(part)
            );

            // Optimize the cut chain
            const optimizeResult = optimizeChainStartPoint(cutChain, {
                tolerance: 0.001,
                splitPosition: 'midpoint',
            });

            expect(optimizeResult.modified).toBe(true);
            const optimizedChain = optimizeResult.optimizedChain!;

            // Verify originalChainId is preserved
            expect(optimizedChain.originalChainId).toBe(part.voids[0].chain.id);

            // Calculate normal AFTER optimization
            const normalAfter = calculateCutNormal(
                optimizedChain,
                CutDirection.COUNTERCLOCKWISE,
                new Part(part)
            );

            // Both normals should be on the LEFT side (for hole + CCW)
            expect(normalBefore.normalSide).toBe(NormalSide.LEFT);
            expect(normalAfter.normalSide).toBe(NormalSide.LEFT);
        });

        it('should correctly flip normal with INNER kerf after optimization', () => {
            // Simple rectangular shell
            const part: PartData = {
                id: 'part-test',
                name: 'part-test',
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                shell: {
                    id: 'chain-shell',
                    name: 'Shell',
                    shapes: [
                        {
                            id: 'line1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 100, y: 0 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 100, y: 0 },
                                end: { x: 100, y: 100 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 100, y: 100 },
                                end: { x: 0, y: 100 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 100 },
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

            // Create cut chain
            const shellChain = new Chain(part.shell);
            const cutChainResult = createCutChain(
                shellChain,
                CutDirection.CLOCKWISE,
                undefined
            );
            const cutChain = cutChainResult.cutChain;

            // Optimize the chain
            const optimizeResult = optimizeChainStartPoint(cutChain, {
                tolerance: 0.001,
                splitPosition: 'midpoint',
            });
            const optimizedChain = optimizeResult.optimizedChain!;

            // Test without kerf compensation (should be LEFT for shell + CW)
            const normalNoKerf = calculateCutNormal(
                optimizedChain,
                CutDirection.CLOCKWISE,
                new Part(part)
            );
            expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);

            // Test with INNER kerf compensation (should flip to RIGHT)
            const normalWithInnerKerf = calculateCutNormal(
                optimizedChain,
                CutDirection.CLOCKWISE,
                new Part(part),
                OffsetDirection.INSET
            );
            expect(normalWithInnerKerf.normalSide).toBe(NormalSide.RIGHT);

            // Verify they are opposite
            expect(normalNoKerf.normalSide).not.toBe(
                normalWithInnerKerf.normalSide
            );
        });

        it('should correctly flip normal with OUTER kerf on hole after optimization', () => {
            // Part with hole
            const part: PartData = {
                id: 'part-test',
                name: 'part-test',
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 200, y: 200 } },
                shell: {
                    id: 'chain-shell',
                    name: 'Shell',
                    shapes: [
                        {
                            id: 'line1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 200, y: 0 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line2',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 200, y: 0 },
                                end: { x: 200, y: 200 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line3',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 200, y: 200 },
                                end: { x: 0, y: 200 },
                            },
                            layer: '0',
                        },
                        {
                            id: 'line4',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 200 },
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
                            name: 'Hole',
                            shapes: [
                                {
                                    id: 'hole-line1',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 50, y: 50 },
                                        end: { x: 150, y: 50 },
                                    },
                                    layer: '0',
                                },
                                {
                                    id: 'hole-line2',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 150, y: 50 },
                                        end: { x: 150, y: 150 },
                                    },
                                    layer: '0',
                                },
                                {
                                    id: 'hole-line3',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 150, y: 150 },
                                        end: { x: 50, y: 150 },
                                    },
                                    layer: '0',
                                },
                                {
                                    id: 'hole-line4',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 50, y: 150 },
                                        end: { x: 50, y: 50 },
                                    },
                                    layer: '0',
                                },
                            ],
                            clockwise: false,
                        },
                        type: PartType.HOLE,
                        boundingBox: {
                            min: { x: 50, y: 50 },
                            max: { x: 150, y: 150 },
                        },
                    },
                ],
                slots: [],
                layerName: '0',
            };

            // Create cut chain for hole
            const holeChain = new Chain(part.voids[0].chain);
            const cutChainResult = createCutChain(
                holeChain,
                CutDirection.COUNTERCLOCKWISE,
                undefined
            );
            const cutChain = cutChainResult.cutChain;

            // Optimize the chain
            const optimizeResult = optimizeChainStartPoint(cutChain, {
                tolerance: 0.001,
                splitPosition: 'midpoint',
            });
            const optimizedChain = optimizeResult.optimizedChain!;

            // Test without kerf compensation (should be LEFT for hole + CCW)
            const normalNoKerf = calculateCutNormal(
                optimizedChain,
                CutDirection.COUNTERCLOCKWISE,
                new Part(part)
            );
            expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);

            // Test with OUTER kerf compensation (should flip to RIGHT)
            const normalWithOuterKerf = calculateCutNormal(
                optimizedChain,
                CutDirection.COUNTERCLOCKWISE,
                new Part(part),
                OffsetDirection.OUTSET
            );
            expect(normalWithOuterKerf.normalSide).toBe(NormalSide.RIGHT);

            // Verify they are opposite
            expect(normalNoKerf.normalSide).not.toBe(
                normalWithOuterKerf.normalSide
            );
        });
    });

    /**
     * Test that standalone chains (without part context) respect kerf compensation
     */
    describe('Standalone Chain Normals with Kerf Compensation', () => {
        it('should flip normal with INSET kerf on standalone chain (no part context)', () => {
            // Simple rectangular chain (no part context)
            const chain: ChainData = {
                id: 'chain-standalone',
                name: 'Standalone Chain',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 100 },
                            end: { x: 0, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 100 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            };

            // Test without kerf compensation (should be LEFT for CW)
            const normalNoKerf = calculateCutNormal(
                new Chain(chain),
                CutDirection.CLOCKWISE,
                undefined // No part context
            );
            expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);

            // Test with INSET kerf compensation (should flip to RIGHT)
            const normalWithInsetKerf = calculateCutNormal(
                new Chain(chain),
                CutDirection.CLOCKWISE,
                undefined, // No part context
                OffsetDirection.INSET
            );
            expect(normalWithInsetKerf.normalSide).toBe(NormalSide.RIGHT);

            // Verify they are opposite
            expect(normalNoKerf.normalSide).not.toBe(
                normalWithInsetKerf.normalSide
            );
        });

        it('should flip normal with INSET kerf on CCW standalone chain', () => {
            // Simple rectangular chain (no part context)
            const chain: ChainData = {
                id: 'chain-standalone',
                name: 'Standalone Chain',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 100 },
                            end: { x: 0, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 100 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            };

            // Test without kerf compensation (should be RIGHT for CCW)
            const normalNoKerf = calculateCutNormal(
                new Chain(chain),
                CutDirection.COUNTERCLOCKWISE,
                undefined // No part context
            );
            expect(normalNoKerf.normalSide).toBe(NormalSide.RIGHT);

            // Test with INSET kerf compensation (should flip to LEFT)
            const normalWithInsetKerf = calculateCutNormal(
                new Chain(chain),
                CutDirection.COUNTERCLOCKWISE,
                undefined, // No part context
                OffsetDirection.INSET
            );
            expect(normalWithInsetKerf.normalSide).toBe(NormalSide.LEFT);

            // Verify they are opposite
            expect(normalNoKerf.normalSide).not.toBe(
                normalWithInsetKerf.normalSide
            );
        });

        it('should NOT flip normal with OUTSET kerf on standalone chain', () => {
            // Simple rectangular chain (no part context)
            const chain: ChainData = {
                id: 'chain-standalone',
                name: 'Standalone Chain',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 100 },
                            end: { x: 0, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 100 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            };

            // Test without kerf compensation
            const normalNoKerf = calculateCutNormal(
                new Chain(chain),
                CutDirection.CLOCKWISE,
                undefined // No part context
            );

            // Test with OUTSET kerf compensation (should NOT flip)
            const normalWithOutsetKerf = calculateCutNormal(
                new Chain(chain),
                CutDirection.CLOCKWISE,
                undefined, // No part context
                OffsetDirection.OUTSET
            );

            // Both should be LEFT (no flip for OUTSET)
            expect(normalNoKerf.normalSide).toBe(NormalSide.LEFT);
            expect(normalWithOutsetKerf.normalSide).toBe(NormalSide.LEFT);
            expect(normalNoKerf.normalSide).toBe(
                normalWithOutsetKerf.normalSide
            );
        });

        it('should flip normal with INSET kerf after optimization (no part context)', () => {
            // Standalone chain
            const chain: ChainData = {
                id: 'chain-standalone',
                name: 'Standalone Chain',
                shapes: [
                    {
                        id: 'line1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 0 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 0 },
                            end: { x: 100, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 100, y: 100 },
                            end: { x: 0, y: 100 },
                        },
                        layer: '0',
                    },
                    {
                        id: 'line4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 100 },
                            end: { x: 0, y: 0 },
                        },
                        layer: '0',
                    },
                ],
                clockwise: true,
            };

            // Create cut chain
            const chainObj = new Chain(chain);
            const cutChainResult = createCutChain(
                chainObj,
                CutDirection.COUNTERCLOCKWISE,
                undefined
            );
            const cutChain = cutChainResult.cutChain;

            // Optimize the chain
            const optimizeResult = optimizeChainStartPoint(cutChain, {
                tolerance: 0.001,
                splitPosition: 'midpoint',
            });
            const optimizedChain = optimizeResult.optimizedChain!;

            // Test without kerf (should be RIGHT for CCW)
            const normalNoKerf = calculateCutNormal(
                optimizedChain,
                CutDirection.COUNTERCLOCKWISE,
                undefined // No part context
            );
            expect(normalNoKerf.normalSide).toBe(NormalSide.RIGHT);

            // Test with INSET kerf (should flip to LEFT)
            const normalWithInsetKerf = calculateCutNormal(
                optimizedChain,
                CutDirection.COUNTERCLOCKWISE,
                undefined, // No part context
                OffsetDirection.INSET
            );
            expect(normalWithInsetKerf.normalSide).toBe(NormalSide.LEFT);

            // Verify they are opposite
            expect(normalNoKerf.normalSide).not.toBe(
                normalWithInsetKerf.normalSide
            );
        });
    });
});
