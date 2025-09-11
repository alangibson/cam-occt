import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import {
    detectShapeChains,
    type Chain,
} from './chain-detection/chain-detection';
import { normalizeChain } from './chain-normalization/chain-normalization';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import type { Shape } from '../types/geometry';

describe('Simple Chain Comparison - Find Root Differences', () => {
    it('should compare properties of working vs failing chains', async () => {
        // Load the DXF file
        const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');

        // Parse DXF
        const drawing = await parseDXF(dxfContent, {
            decomposePolylines: true,
            translateToPositiveQuadrant: true,
            squashLayers: true,
        });

        // Detect chains
        const tolerance = 1.0;
        const chains = detectShapeChains(drawing.shapes, { tolerance });

        // Normalize chains
        const normalizedChains = chains.map((chain) => normalizeChain(chain));

        // Find the specific chains
        const chain7 = normalizedChains.find((chain) => chain.id === 'chain-7');
        const chain8 = normalizedChains.find((chain) => chain.id === 'chain-8');
        const chain9 = normalizedChains.find((chain) => chain.id === 'chain-9');

        expect(chain7).toBeDefined();
        expect(chain8).toBeDefined();
        expect(chain9).toBeDefined();

        const chainsToCompare = [
            { name: 'chain-7 (WORKS)', chain: chain7!, status: 'CONTAINED' },
            {
                name: 'chain-8 (FAILS)',
                chain: chain8!,
                status: 'NOT CONTAINED',
            },
            { name: 'chain-9 (WORKS)', chain: chain9!, status: 'CONTAINED' },
        ];

        for (const { chain } of chainsToCompare) {
            // Check gap distance
            const firstShape = chain.shapes[0];
            const lastShape = chain.shapes[chain.shapes.length - 1];
            getShapeStartPoint(firstShape);
            getShapeEndPoint(lastShape);

            // Analyze shape types
            chain.shapes.map((shape) => shape.type);

            // Check connectivity between sequential shapes
            let maxSequentialGap = 0;

            for (let i: number = 0; i < chain.shapes.length - 1; i++) {
                const currentEnd = getShapeEndPoint(chain.shapes[i]);
                const nextStart = getShapeStartPoint(chain.shapes[i + 1]);

                const gap = Math.sqrt(
                    Math.pow(currentEnd.x - nextStart.x, 2) +
                        Math.pow(currentEnd.y - nextStart.y, 2)
                );
                maxSequentialGap = Math.max(maxSequentialGap, gap);

                if (gap > 0.1) {
                    // Gap detected but not processed in this analysis
                }
            }
        }

        // Compare the working chains vs the failing one
        const workingChains = [chain7!, chain9!];
        const failingChain = chain8!;

        // Check if there's a pattern in shape counts
        const _workingShapeCounts = workingChains.map((c) => c.shapes.length);
        const _failingShapeCount = failingChain.shapes.length;

        // Check shape type patterns
        const getShapeTypePattern = (chain: Chain) => {
            const types = chain.shapes.map((s: Shape) => s.type);
            const counts = types.reduce(
                (c: Record<string, number>, t: string) => {
                    c[t] = (c[t] || 0) + 1;
                    return c;
                },
                {}
            );
            return counts;
        };

        const workingPatterns = workingChains.map(getShapeTypePattern);
        const failingPattern = getShapeTypePattern(failingChain);

        workingPatterns.forEach(() => {});

        // Look for differences
        const hasPolylines = (pattern: Record<string, number>) =>
            pattern.polyline > 0;
        const hasLines = (pattern: Record<string, number>) => pattern.line > 0;

        const workingHavePolylines = workingPatterns.every(hasPolylines);
        const workingHaveLines = workingPatterns.every(hasLines);
        const failingHasPolylines = hasPolylines(failingPattern);
        const failingHasLines = hasLines(failingPattern);

        if (
            workingHavePolylines !== failingHasPolylines ||
            workingHaveLines !== failingHasLines
        ) {
            // Pattern difference detected - could be root cause of detection failure
        }

        expect(chain7!.shapes.length).toBeGreaterThan(0);
    }, 10000);
});
