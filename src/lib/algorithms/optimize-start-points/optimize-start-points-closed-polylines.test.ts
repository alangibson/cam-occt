import { Chain } from '$lib/cam/chain/classes';
import { describe, expect, it } from 'vitest';
import { optimizeStartPoints } from './optimize-start-points';
import { isChainClosed } from '$lib/cam/chain/functions';
import { createPolylineFromVertices } from '$lib/geometry/polyline/functions';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM } from '$lib/cam/preprocess/algorithm-parameters';

describe('optimizeStartPoints - closed polylines', () => {
    const optimizationParams = {
        ...DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS_MM,
        tolerance: 0.1,
    };

    it('should recognize single closed polylines as closed chains', () => {
        // Simulate ADLER.dxf style - single closed polyline in a chain
        const closedPolyline = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
            ],
            true,
            { id: 'closed-polyline-1' }
        );

        const chain: ChainData = {
            id: 'chain-1',
            name: 'chain-1',
            shapes: [closedPolyline],
        };

        // First, verify that isChainClosed correctly identifies this as closed
        const chainInstance = new Chain(chain);
        expect(isChainClosed(chainInstance, optimizationParams.tolerance)).toBe(
            true
        );

        // Now test optimization
        const result = optimizeStartPoints([chainInstance], optimizationParams);

        // Should have split the polyline (original 1 shape -> 2 split shapes)
        expect(result.length).toBe(2);

        // Should have split the polyline
        const splitShapes = result.filter((s) => s.id.includes('-split-'));
        expect(splitShapes.length).toBe(2);
    });

    it('should handle ADLER.dxf scenario - multiple single closed polyline chains', () => {
        // Simulate typical ADLER.dxf structure - each chain contains one closed polyline
        const chains: ChainData[] = [];

        for (let i: number = 0; i < 3; i++) {
            const closedPolyline = createPolylineFromVertices(
                [
                    { x: i * 20, y: 0 },
                    { x: i * 20 + 15, y: 0 },
                    { x: i * 20 + 15, y: 8 },
                    { x: i * 20 + 10, y: 12 },
                    { x: i * 20 + 5, y: 8 },
                    { x: i * 20, y: 8 },
                ],
                true,
                { id: `adler-polyline-${i}` }
            );

            chains.push({
                id: `adler-chain-${i}`,
                name: 'adler-chain-${i}',
                shapes: [closedPolyline],
            });
        }

        // Verify all chains are recognized as closed
        const chainInstances = chains.map((c) => new Chain(c));
        chainInstances.forEach((chain) => {
            expect(isChainClosed(chain, optimizationParams.tolerance)).toBe(
                true
            );
        });

        const result = optimizeStartPoints(chainInstances, optimizationParams);

        // Should have optimized all 3 chains (3 original polylines -> 6 split shapes)
        expect(result.length).toBe(6);

        // All should have been split
        const splitShapes = result.filter((s) => s.id.includes('-split-'));
        expect(splitShapes.length).toBe(6);
    });

    it('should not optimize open polylines', () => {
        const openPolyline = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            false,
            { id: 'open-polyline-1' }
        );

        const chain: ChainData = {
            id: 'open-chain',
            name: 'open-chain',
            shapes: [openPolyline],
        };

        // Verify it's not recognized as closed
        const chainInstance = new Chain(chain);
        expect(isChainClosed(chainInstance, optimizationParams.tolerance)).toBe(
            false
        );

        const result = optimizeStartPoints([chainInstance], optimizationParams);

        // Should not have been modified
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('open-polyline-1');
    });

    it('should handle polylines without explicit closed flag by checking geometric closure', () => {
        // Some polylines might not have the closed flag but are geometrically closed
        const geometricallyClosedPolyline = createPolylineFromVertices(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 5, y: 10 },
                { x: 0.05, y: 0.05 }, // Distance = sqrt(0.05² + 0.05²) ≈ 0.071 < 0.1 tolerance
            ],
            false,
            { id: 'geo-closed-polyline' }
        ); // No explicit closed flag, relies on geometric closure

        const chain: ChainData = {
            id: 'geo-closed-chain',
            name: 'geo-closed-chain',
            shapes: [geometricallyClosedPolyline],
        };

        // Should fall back to geometric check and recognize as closed
        const chainInstance = new Chain(chain);
        expect(isChainClosed(chainInstance, optimizationParams.tolerance)).toBe(
            true
        );

        const result = optimizeStartPoints([chainInstance], optimizationParams);

        // Should have been optimized
        expect(result.length).toBe(2);
        const splitShapes = result.filter((s) => s.id.includes('-split-'));
        expect(splitShapes.length).toBe(2);
    });
});
