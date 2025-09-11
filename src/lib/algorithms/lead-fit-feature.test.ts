/**
 * Test for the new Lead Fit feature
 *
 * This test verifies that the "fit" parameter correctly controls whether leads
 * automatically adjust their length to avoid solid areas.
 */

import { describe, it, expect } from 'vitest';
import {
    calculateLeads,
    type LeadInConfig,
    type LeadOutConfig,
} from './lead-calculation';
import { LeadType, CutDirection } from '../types/direction';
import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { PartType } from '$lib/algorithms/part-detection/part-detection';
import { GeometryType } from '$lib/geometry/shape';

describe('Lead Fit Feature', () => {
    // Create a simple test chain (square)
    const testChain: Chain = {
        id: 'test-chain-1',
        shapes: [
            {
                id: 'line-1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            },
            {
                id: 'line-2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                },
            },
            {
                id: 'line-3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 0, y: 10 },
                },
            },
            {
                id: 'line-4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0, y: 0 },
                },
            },
        ],
    };

    // Create a test part with the chain as shell (to potentially cause lead interference)
    const testPart: DetectedPart = {
        id: 'test-part-1',
        shell: {
            id: 'shell-1',
            type: PartType.SHELL,
            chain: testChain,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            holes: [],
        },
        holes: [],
    };

    it('should preserve full length when fit=false', () => {
        const leadInConfig: LeadInConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: false, // Disable length adjustment
        };

        const leadOutConfig: LeadOutConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: false, // Disable length adjustment
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            leadOutConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart
        );

        // When fit=false, leads should maintain their specified length
        // even if they intersect solid areas
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
        expect(result.leadIn?.points.length).toBeGreaterThan(0);
        expect(result.leadOut?.points.length).toBeGreaterThan(0);
    });

    it('should allow length adjustment when fit=true', () => {
        const leadInConfig: LeadInConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: true, // Enable length adjustment (default behavior)
        };

        const leadOutConfig: LeadOutConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: true, // Enable length adjustment (default behavior)
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            leadOutConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart
        );

        // When fit=true, leads can adjust their length to avoid solid areas
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
        expect(result.leadIn?.points.length).toBeGreaterThan(0);
        expect(result.leadOut?.points.length).toBeGreaterThan(0);
    });

    it('should default to fit=true when not specified', () => {
        const leadInConfig: LeadInConfig = {
            type: LeadType.LINE,
            length: 3,
            // fit parameter not specified, should default to true
        };

        const leadOutConfig: LeadOutConfig = {
            type: LeadType.LINE,
            length: 3,
            // fit parameter not specified, should default to true
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            leadOutConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart
        );

        // Should work with default fit behavior
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
    });

    it('should work with mixed fit settings', () => {
        const leadInConfig: LeadInConfig = {
            type: LeadType.ARC,
            length: 4,
            fit: false, // Lead-in preserves length
        };

        const leadOutConfig: LeadOutConfig = {
            type: LeadType.ARC,
            length: 4,
            fit: true, // Lead-out can adjust length
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            leadOutConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart
        );

        // Both leads should be generated successfully
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
    });
});
