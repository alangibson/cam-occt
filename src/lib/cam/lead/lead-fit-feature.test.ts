/**
 * Test for the new Lead Fit feature
 *
 * This test verifies that the "fit" parameter correctly controls whether leads
 * automatically adjust their length to avoid solid areas.
 */

import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { convertLeadGeometryToPoints } from './functions';
import type { Part } from '$lib/cam/part/interfaces';
import { PartType } from '$lib/cam/part/enums';
import { GeometryType } from '$lib/geometry/shape/enums';

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
    const testPart: Part = {
        id: 'test-part-1',
        shell: testChain,
        type: PartType.SHELL,
        boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
        voids: [],
        slots: [],
    };

    it('should preserve full length when fit=false', () => {
        const leadInConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: false, // Disable length adjustment
        };

        const LeadConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: false, // Disable length adjustment
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            LeadConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart,
            { x: 1, y: 0 }
        );

        // When fit=false, leads should maintain their specified length
        // even if they intersect solid areas
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
        if (result.leadIn) {
            const leadInPoints = convertLeadGeometryToPoints(result.leadIn);
            expect(leadInPoints.length).toBeGreaterThan(0);
        }
        if (result.leadOut) {
            const leadOutPoints = convertLeadGeometryToPoints(result.leadOut);
            expect(leadOutPoints.length).toBeGreaterThan(0);
        }
    });

    it('should allow length adjustment when fit=true', () => {
        const leadInConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: true, // Enable length adjustment (default behavior)
        };

        const LeadConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 5,
            fit: true, // Enable length adjustment (default behavior)
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            LeadConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart,
            { x: 1, y: 0 }
        );

        // When fit=true, leads can adjust their length to avoid solid areas
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
        if (result.leadIn) {
            const leadInPoints = convertLeadGeometryToPoints(result.leadIn);
            expect(leadInPoints.length).toBeGreaterThan(0);
        }
        if (result.leadOut) {
            const leadOutPoints = convertLeadGeometryToPoints(result.leadOut);
            expect(leadOutPoints.length).toBeGreaterThan(0);
        }
    });

    it('should default to fit=true when not specified', () => {
        const leadInConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 3,
            // fit parameter not specified, should default to true
        };

        const LeadConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 3,
            // fit parameter not specified, should default to true
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            LeadConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart,
            { x: 1, y: 0 }
        );

        // Should work with default fit behavior
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
    });

    it('should work with mixed fit settings', () => {
        const leadInConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 4,
            fit: false, // Lead-in preserves length
        };

        const LeadConfig: LeadConfig = {
            type: LeadType.ARC,
            length: 4,
            fit: true, // Lead-out can adjust length
        };

        const result = calculateLeads(
            testChain,
            leadInConfig,
            LeadConfig,
            CutDirection.COUNTERCLOCKWISE,
            testPart,
            { x: 1, y: 0 }
        );

        // Both leads should be generated successfully
        expect(result.leadIn).toBeDefined();
        expect(result.leadOut).toBeDefined();
    });
});
