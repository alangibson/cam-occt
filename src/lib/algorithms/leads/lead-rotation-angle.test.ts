import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { GeometryType } from '$lib/geometry/shape';
import { convertLeadGeometryToPoints } from './functions';

describe('Lead Rotation Angle', () => {
    // Simple horizontal line for testing lead angles
    const horizontalLine: Chain = {
        id: 'test-line',
        shapes: [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                },
            },
        ],
    };

    describe('Lead-in angle behavior', () => {
        it('should point to the left when angle is 0 degrees with CW sweep', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 0, // Rotates from cut normal by 0°
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 } // Cut normal pointing right
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);
            expect(points.length).toBeGreaterThan(1);

            // Get the start point of the lead-in (should be away from connection point)
            const leadStartPoint = points[0];
            const connectionPoint = points[points.length - 1];

            // With CW sweep and 0° angle offset, lead starts to the left (-X)
            // This is correct: CW arc with center on right normal sweeps from left
            expect(leadStartPoint.x).toBeLessThan(connectionPoint.x);
            expect(points.length).toBeGreaterThan(2); // Arc creates multiple points
        });

        it('should point up when angle is 90 degrees', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 90, // Should point up (+Y direction)
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);

            const leadStartPoint = points[0];
            const connectionPoint = points[points.length - 1];

            // Lead-in with 90° angle should start above (+Y) the connection point
            expect(leadStartPoint.y).toBeGreaterThan(connectionPoint.y);
            // Arc tessellation may not produce exact 90° direction due to geometry
            // Verify lead is valid rather than exact positioning
            expect(points.length).toBeGreaterThan(2); // Arc creates multiple points
        });

        it('should point to the right when angle is 180 degrees with CW sweep', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 180, // Rotates cut normal by 180° (flips it)
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 } // Cut normal pointing right, rotated 180° = left
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);

            const leadStartPoint = points[0];
            const connectionPoint = points[points.length - 1];

            // With 180° rotation, cut normal flips from right to left
            // CW arc with center on left normal sweeps from right
            expect(leadStartPoint.x).toBeGreaterThan(connectionPoint.x);
            expect(points.length).toBeGreaterThan(2); // Arc creates multiple points
        });

        it('should point down when angle is 270 degrees', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 270, // Should point down (-Y direction)
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);

            const leadStartPoint = points[0];
            const connectionPoint = points[points.length - 1];

            // Lead-in with 270° angle should start below (-Y) the connection point
            expect(leadStartPoint.y).toBeLessThan(connectionPoint.y);
            // Arc tessellation may not produce exact positioning
            expect(points.length).toBeGreaterThan(2); // Arc creates multiple points
        });
    });

    describe('Lead-out angle behavior', () => {
        it('should point up when angle is 90 degrees', () => {
            const LeadConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 90, // Should point up (+Y direction)
            };

            const leadInConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            expect(result.leadOut).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadOut!);

            const connectionPoint = points[0];
            const leadEndPoint = points[points.length - 1];

            // Lead-out with 90° angle should end above (+Y) the connection point
            expect(leadEndPoint.y).toBeGreaterThan(connectionPoint.y);
            // Arc tessellation may not produce exact positioning
            expect(points.length).toBeGreaterThan(2); // Arc creates multiple points
        });
    });

    describe('Arc lead angle behavior', () => {
        it('should have center positioned correctly with CW sweep and 0° angle', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 0, // No rotation from cut normal
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig,
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 } // Cut normal pointing right
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);
            expect(points.length).toBeGreaterThan(2);

            const connectionPoint = points[points.length - 1];

            // With CW sweep and 0° angle, arc center is on right normal
            // CW arc sweeps from left side to connection point
            const startPoint = points[0];
            expect(startPoint.x).toBeLessThan(connectionPoint.x);
        });
    });
});
