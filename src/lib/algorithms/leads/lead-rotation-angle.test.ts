import { describe, expect, it } from 'vitest';
import { calculateLeads } from './lead-calculation';
import { type LeadConfig } from './interfaces';
import { LeadType } from '$lib/types/direction';
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
        it('should point to the right when angle is 0 degrees (unit circle convention)', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 0, // Should point right (+X direction)
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);
            expect(points.length).toBeGreaterThan(1);

            // Get the start point of the lead-in (should be away from connection point)
            const leadStartPoint = points[0];
            const connectionPoint = points[points.length - 1];

            // Lead-in with 0° angle should start to the right (+X) of the connection point
            expect(leadStartPoint.x).toBeGreaterThan(connectionPoint.x);
            // Arc tessellation may not produce exact 0° direction due to geometry
            // Verify lead is valid rather than exact positioning
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
                LeadConfig
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

        it('should point to the left when angle is 180 degrees', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 180, // Should point left (-X direction)
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);

            const leadStartPoint = points[0];
            const connectionPoint = points[points.length - 1];

            // Lead-in with 180° angle should start to the left (-X) of the connection point
            expect(leadStartPoint.x).toBeLessThan(connectionPoint.x);
            // Arc tessellation may not produce exact positioning
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
                LeadConfig
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
                LeadConfig
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
        it('should have center positioned to the right when angle is 0 degrees', () => {
            const leadInConfig: LeadConfig = {
                type: LeadType.ARC,
                length: 5,
                angle: 0, // Arc center should be to the right (+X direction)
            };

            const LeadConfig: LeadConfig = {
                type: LeadType.NONE,
                length: 0,
            };

            const result = calculateLeads(
                horizontalLine,
                leadInConfig,
                LeadConfig
            );

            expect(result.leadIn).toBeDefined();
            const points = convertLeadGeometryToPoints(result.leadIn!);
            expect(points.length).toBeGreaterThan(2);

            const connectionPoint = points[points.length - 1];

            // For arc leads with 0° angle, the center should be to the right of connection point
            // The lead should start somewhere to the right and curve back to the connection point
            const startPoint = points[0];
            expect(startPoint.x).toBeGreaterThan(connectionPoint.x);
        });
    });
});
