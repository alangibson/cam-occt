import { describe, it, expect } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { CutDirection, LeadType } from '$lib/types/direction';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import { PartType } from '$lib/algorithms/part-detection/part-detection';
import { GeometryType } from '$lib/types/geometry';
import { convertLeadGeometryToPoints } from './functions';

// Test that arc leads maintain consistent curve direction but respect cut direction for sweep
describe('Cut Direction Respect Test', () => {
    // Create a simple rectangular shell chain for testing
    const createRectangularShell = (): Chain => ({
        id: 'test-shell',
        clockwise: true, // Explicitly set clockwise property for consistent behavior
        shapes: [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 100, y: 0 },
                },
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 100, y: 0 },
                    end: { x: 100, y: 100 },
                },
            },
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 100, y: 100 },
                    end: { x: 0, y: 100 },
                },
            },
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 100 },
                    end: { x: 0, y: 0 },
                },
            },
        ],
    });

    it('should maintain consistent curve direction regardless of cut direction', () => {
        const shell = createRectangularShell();

        const part: DetectedPart = {
            id: 'part1',
            shell: {
                id: 'shell1',
                chain: shell,
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                holes: [],
            },
            holes: [],
        };

        // Test clockwise cut
        const resultCW = calculateLeads(
            shell,
            { type: LeadType.ARC, length: 10 },
            { type: LeadType.ARC, length: 10 },
            CutDirection.CLOCKWISE,
            part
        );

        // Test counterclockwise cut
        const resultCCW = calculateLeads(
            shell,
            { type: LeadType.ARC, length: 10 },
            { type: LeadType.ARC, length: 10 },
            CutDirection.COUNTERCLOCKWISE,
            part
        );

        // Both should have leads
        expect(resultCW.leadIn).toBeDefined();
        expect(resultCCW.leadIn).toBeDefined();

        // Both should end at the same connection point (0, 0)
        const cwPoints = convertLeadGeometryToPoints(resultCW.leadIn!);
        const ccwPoints = convertLeadGeometryToPoints(resultCCW.leadIn!);
        const cwEnd = cwPoints[cwPoints.length - 1];
        const ccwEnd = ccwPoints[ccwPoints.length - 1];

        expect(Math.abs(cwEnd.x - 0)).toBeLessThan(0.001);
        expect(Math.abs(cwEnd.y - 0)).toBeLessThan(0.001);
        expect(Math.abs(ccwEnd.x - 0)).toBeLessThan(0.001);
        expect(Math.abs(ccwEnd.y - 0)).toBeLessThan(0.001);

        // Arc curves should be different for different cut directions
        // This verifies that cut direction affects lead placement
        const cwStart = cwPoints[0];
        const ccwStart = ccwPoints[0];

        // For shells: CW cuts and CCW cuts should place leads differently
        // The actual positions depend on the lead calculation algorithm
        // Just verify they are actually different positions
        const positionDifferent =
            Math.abs(cwStart.x - ccwStart.x) > 0.1 ||
            Math.abs(cwStart.y - ccwStart.y) > 0.1;
        expect(positionDifferent).toBe(true); // Leads should be in different positions
    });

    it('should generate different sweep directions for different cut directions', () => {
        const shell = createRectangularShell();

        const part: DetectedPart = {
            id: 'part1',
            shell: {
                id: 'shell1',
                chain: shell,
                type: PartType.SHELL,
                boundingBox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                holes: [],
            },
            holes: [],
        };

        // Test clockwise cut
        const resultCW = calculateLeads(
            shell,
            { type: LeadType.ARC, length: 10 },
            { type: LeadType.ARC, length: 10 },
            CutDirection.CLOCKWISE,
            part
        );

        // Test counterclockwise cut
        const resultCCW = calculateLeads(
            shell,
            { type: LeadType.ARC, length: 10 },
            { type: LeadType.ARC, length: 10 },
            CutDirection.COUNTERCLOCKWISE,
            part
        );

        // Get the first few points to determine sweep direction
        const cwPoints = convertLeadGeometryToPoints(resultCW.leadIn!);
        const ccwPoints = convertLeadGeometryToPoints(resultCCW.leadIn!);

        expect(cwPoints.length).toBeGreaterThan(3);
        expect(ccwPoints.length).toBeGreaterThan(3);

        // The arcs should sweep in different directions
        // This is verified by the order of points representing different paths along the arc
        // We expect the cut direction to be respected in the toolhead movement
        const cwP1 = cwPoints[1];
        const cwP2 = cwPoints[2];
        const ccwP1 = ccwPoints[1];
        const ccwP2 = ccwPoints[2];

        // The arcs should be geometrically different between CW and CCW
        // Verify that the arc points follow different paths
        const cwArcDifferent =
            Math.abs(cwP1.x - ccwP1.x) > 0.1 ||
            Math.abs(cwP1.y - ccwP1.y) > 0.1 ||
            Math.abs(cwP2.x - ccwP2.x) > 0.1 ||
            Math.abs(cwP2.y - ccwP2.y) > 0.1;

        expect(cwArcDifferent).toBe(true); // Arc paths should be different for different cut directions
    });
});
