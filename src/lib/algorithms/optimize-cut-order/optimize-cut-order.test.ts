import { describe, it, expect } from 'vitest';
import { optimizeCutOrder } from './optimize-cut-order';
import type { Path } from '$lib/stores/paths';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape, Ellipse, Circle, Line, Arc, Polyline } from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import { GeometryType } from '$lib/types/geometry';
import { CutDirection } from '$lib/types/direction';
import { createPolylineFromVertices } from '$lib/geometry/polyline';

describe('Optimize Cut Order', () => {
    it('should handle ellipse shapes in chains', () => {
        // Create an ellipse shape
        const ellipseShape: Shape = {
            id: 'shape-1',
            type: GeometryType.ELLIPSE,
            geometry: {
                center: { x: 50, y: 50 },
                majorAxisEndpoint: { x: 30, y: 0 }, // Major axis is 30 units along X
                minorToMajorRatio: 0.5, // Minor axis is 15 units
                startParam: 0,
                endParam: 2 * Math.PI,
            } as Ellipse,
        };

        // Create a chain with the ellipse
        const chain: Chain = {
            id: 'chain-1',
            shapes: [ellipseShape],
        };

        // Create a path for the chain
        const path: Path = {
            id: 'path-1',
            name: 'Path 1',
            chainId: 'chain-1',
            operationId: 'op-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        };

        // Create a map of chains
        const chains = new Map<string, Chain>();
        chains.set('chain-1', chain);

        // Test with no parts
        const result = optimizeCutOrder([path], chains, []);

        // Verify the result
        expect(result.orderedPaths).toHaveLength(1);
        expect(result.orderedPaths[0].id).toBe('path-1');
        expect(result.rapids).toHaveLength(1);
        expect(result.rapids[0].type).toBe('rapid');
        expect(result.rapids[0].start).toEqual({ x: 0, y: 0 }); // From origin
        expect(result.rapids[0].end.x).toBeCloseTo(80, 1); // 50 + 30 (center + major axis)
        expect(result.rapids[0].end.y).toBeCloseTo(50, 1); // Center Y
    });

    it('should handle spline shapes in chains', () => {
        // Create a spline shape
        const splineShape: Shape = {
            id: 'shape-1',
            type: GeometryType.SPLINE,
            geometry: {
                controlPoints: [
                    { x: 10, y: 10 },
                    { x: 20, y: 20 },
                    { x: 30, y: 10 },
                    { x: 40, y: 20 },
                ],
                knots: [],
                weights: [],
                degree: 3,
                fitPoints: [],
                closed: false,
            } as Spline,
        };

        // Create a chain with the spline
        const chain: Chain = {
            id: 'chain-1',
            shapes: [splineShape],
        };

        // Create a path for the chain
        const path: Path = {
            id: 'path-1',
            name: 'Path 1',
            chainId: 'chain-1',
            operationId: 'op-1',
            toolId: 'tool-1',
            enabled: true,
            order: 1,
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        };

        // Create a map of chains
        const chains = new Map<string, Chain>();
        chains.set('chain-1', chain);

        // Test with no parts
        const result = optimizeCutOrder([path], chains, []);

        // Verify the result
        expect(result.orderedPaths).toHaveLength(1);
        expect(result.orderedPaths[0].id).toBe('path-1');
        expect(result.rapids).toHaveLength(1);
        expect(result.rapids[0].type).toBe('rapid');
        expect(result.rapids[0].start).toEqual({ x: 0, y: 0 }); // From origin
        expect(result.rapids[0].end).toEqual({ x: 10, y: 10 }); // First point of polyline
    });

    it('should handle all shape types without throwing errors', () => {
        const shapeTypes = [
            'line',
            'arc',
            'circle',
            'polyline',
            'spline',
            'ellipse',
        ];
        const chains = new Map<string, Chain>();
        const paths: Path[] = [];

        // Create a shape for each type
        shapeTypes.forEach((type, index) => {
            let geometry: Line | Arc | Circle | Polyline | Ellipse | Spline;

            switch (type) {
                case 'line':
                    geometry = {
                        start: { x: 0, y: 0 },
                        end: { x: 10, y: 10 },
                    } as Line;
                    break;
                case 'arc':
                    geometry = {
                        center: { x: 5, y: 5 },
                        radius: 5,
                        startAngle: 0,
                        endAngle: 90,
                        clockwise: true,
                    };
                    break;
                case 'circle':
                    geometry = { center: { x: 5, y: 5 }, radius: 5 } as Circle;
                    break;
                case 'polyline':
                    geometry = createPolylineFromVertices(
                        [
                            { x: 0, y: 0, bulge: 0 },
                            { x: 10, y: 10, bulge: 0 },
                        ],
                        false
                    ).geometry;
                    break;
                case 'spline':
                    geometry = {
                        controlPoints: [
                            { x: 0, y: 0 },
                            { x: 10, y: 10 },
                        ],
                        knots: [],
                        weights: [],
                        degree: 1,
                        fitPoints: [],
                        closed: false,
                    } as Spline;
                    break;
                case 'ellipse':
                    geometry = {
                        center: { x: 5, y: 5 },
                        majorAxisEndpoint: { x: 3, y: 0 },
                        minorToMajorRatio: 0.5,
                    } as Ellipse;
                    break;
                default:
                    geometry = {
                        start: { x: 0, y: 0 },
                        end: { x: 10, y: 10 },
                    } as Line;
                    break;
            }

            const shape: Shape = {
                id: `shape-${index}`,
                type: type as GeometryType,
                geometry,
            };

            const chain: Chain = {
                id: `chain-${index}`,
                shapes: [shape],
            };

            chains.set(chain.id, chain);

            paths.push({
                id: `path-${index}`,
                name: `Path ${index + 1}`,
                chainId: chain.id,
                operationId: 'op-1',
                toolId: 'tool-1',
                enabled: true,
                order: index + 1,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });
        });

        // This should not throw any errors
        const result = optimizeCutOrder(paths, chains, []);

        expect(result.orderedPaths).toHaveLength(shapeTypes.length);
        expect(result.rapids).toHaveLength(shapeTypes.length);
        expect(result.totalDistance).toBeGreaterThan(0);
    });
});
