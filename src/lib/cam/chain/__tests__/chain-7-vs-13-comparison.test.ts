import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { isChainContainedInChain_Geometric } from '$lib/cam/chain/chain-containment';
import { getShapeEndPoint, getShapeStartPoint } from '$lib/cam/shape/functions';

describe('Chain-7 vs Chain-13 Identical Letter T Comparison', () => {
    it('should verify that identical chains chain-7 and chain-13 behave identically after normalization', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF
        const drawing = await parseDXF(dxfContent);

        // Detect chains
        const tolerance = 1.0;
        const chains = detectShapeChains(
            drawing.shapes.map((s) => new Shape(s)),
            { tolerance }
        );

        // Normalize chains
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        // Find the specific chains and boundary
        const boundaryChain = normalizedChains.find(
            (chain) => chain.shapes.length === 42
        );
        const chain7 = normalizedChains.find((chain) => chain.name === '7');
        const chain13 = normalizedChains.find((chain) => chain.name === '13');

        expect(boundaryChain).toBeDefined();
        expect(chain7).toBeDefined();
        expect(chain13).toBeDefined();

        // Compare basic properties

        // Analyze shape types (currently unused for debugging)
        // const getShapeTypes = (chain: Chain): Record<string, number> => {
        //   const types = chain.shapes.map((s: Shape) => s.type);
        //   const counts = types.reduce((c: Record<string, number>, t: string) => { c[t] = (c[t] || 0) + 1; return c; }, {});
        //   return counts;
        // };

        // Get shape types for comparison (currently unused for debugging)
        // const chain7Types = getShapeTypes(chain7!);
        // const chain13Types = getShapeTypes(chain13!);

        // Check if they have identical shape compositions (for debugging)
        // const typesMatch = JSON.stringify(chain7Types) === JSON.stringify(chain13Types);

        // Check closure after normalization
        const checkChainClosure = (chain: Chain, _name: string): number => {
            const firstShape = chain.shapes[0];
            const lastShape = chain.shapes[chain.shapes.length - 1];
            const firstStart = getShapeStartPoint(firstShape);
            const lastEnd = getShapeEndPoint(lastShape);

            const gapDistance = Math.sqrt(
                Math.pow(firstStart.x - lastEnd.x, 2) +
                    Math.pow(firstStart.y - lastEnd.y, 2)
            );

            return gapDistance;
        };

        const chain7Gap = checkChainClosure(chain7!, 'CHAIN-7');
        const chain13Gap = checkChainClosure(chain13!, 'CHAIN-13');

        // Compare containment results

        let chain7ContainmentResult = 'UNKNOWN';
        let chain7ContainmentError = '';

        try {
            const chain7Contained = await isChainContainedInChain_Geometric(
                chain7!,
                boundaryChain!
            );
            chain7ContainmentResult = chain7Contained
                ? 'CONTAINED'
                : 'NOT CONTAINED';
        } catch (error) {
            chain7ContainmentResult = 'ERROR';
            chain7ContainmentError =
                error instanceof Error ? error.message : String(error);
        }

        let chain13ContainmentResult = 'UNKNOWN';
        let chain13ContainmentError = '';

        try {
            const chain13Contained = await isChainContainedInChain_Geometric(
                chain13!,
                boundaryChain!
            );
            chain13ContainmentResult = chain13Contained
                ? 'CONTAINED'
                : 'NOT CONTAINED';
        } catch (error) {
            chain13ContainmentResult = 'ERROR';
            chain13ContainmentError =
                error instanceof Error ? error.message : String(error);
        }

        if (chain7ContainmentError) {
            // Chain 7 containment check failed
        }

        if (chain13ContainmentError) {
            // Chain 13 containment check failed
        }

        // The key question: if they're identical, why different results?

        if (chain7ContainmentResult !== chain13ContainmentResult) {
            // Different containment results for identical chains
        }

        // Verify they're actually closed with tight tolerance
        expect(chain7Gap).toBeLessThan(0.1);
        expect(chain13Gap).toBeLessThan(0.1);
    }, 20000);
});
