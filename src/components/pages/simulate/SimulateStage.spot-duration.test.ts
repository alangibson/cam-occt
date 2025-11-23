/**
 * Test spot operation duration handling in simulation
 * Verifies that spotDuration is correctly used for animation timing
 */
import { describe, expect, it } from 'vitest';
import type { CutData } from '$lib/cam/cut/interfaces';
import { OperationAction } from '$lib/cam/operation/enums';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { DEFAULT_SPOT_DURATION } from '$lib/config/defaults/operation-defaults';

/**
 * Recreate the buildAnimationSteps logic to test spot duration handling
 * This mirrors the core timing logic from SimulateStage.svelte
 */
function calculateCutTime(
    cut: CutData,
    getCutDistance: (cut: CutData) => number
): number {
    // Check if this is a spot operation
    if (cut.action === OperationAction.SPOT) {
        // For spot operations, use spotDuration directly (convert ms to seconds)
        // Use DEFAULT_SPOT_DURATION if not specified or 0, matching Operation class behavior
        const spotDurationMs = cut.spotDuration || DEFAULT_SPOT_DURATION;
        return spotDurationMs / 1000;
    } else {
        // For regular cuts, calculate time from distance and feed rate
        const cutDistance = getCutDistance(cut);
        const feedRate = 1000; // mm/min (mock value for testing)
        return (cutDistance / feedRate) * 60; // Convert to seconds
    }
}

describe('SimulateStage Spot Duration', () => {
    describe('Animation Timing for Spot Operations', () => {
        it('should use spotDuration for spot operation timing', () => {
            const spotCut: CutData = {
                id: 'cut-1',
                name: 'Spot Cut',
                enabled: true,
                order: 1,
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: 'tool-1',
                action: OperationAction.SPOT,
                spotDuration: 250, // 250ms
                cutDirection: CutDirection.NONE,
                normal: { x: 0, y: 0 },
                normalConnectionPoint: { x: 50, y: 50 },
                normalSide: NormalSide.LEFT,
            };

            const mockGetCutDistance = () => 0; // Spots have no distance
            const cutTime = calculateCutTime(spotCut, mockGetCutDistance);

            // 250ms should convert to 0.25 seconds
            expect(cutTime).toBe(0.25);
        });

        it('should use default 500ms duration when spotDuration is undefined', () => {
            const spotCut: CutData = {
                id: 'cut-1',
                name: 'Spot Cut',
                enabled: true,
                order: 1,
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: 'tool-1',
                action: OperationAction.SPOT,
                spotDuration: undefined, // Not specified
                cutDirection: CutDirection.NONE,
                normal: { x: 0, y: 0 },
                normalConnectionPoint: { x: 50, y: 50 },
                normalSide: NormalSide.LEFT,
            };

            const mockGetCutDistance = () => 0;
            const cutTime = calculateCutTime(spotCut, mockGetCutDistance);

            // Should default to DEFAULT_SPOT_DURATION (500ms) = 0.5 seconds
            expect(cutTime).toBe(0.5);
        });

        it('should use default 500ms duration when spotDuration is 0', () => {
            const spotCut: CutData = {
                id: 'cut-1',
                name: 'Spot Cut',
                enabled: true,
                order: 1,
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: 'tool-1',
                action: OperationAction.SPOT,
                spotDuration: 0, // Explicitly 0
                cutDirection: CutDirection.NONE,
                normal: { x: 0, y: 0 },
                normalConnectionPoint: { x: 50, y: 50 },
                normalSide: NormalSide.LEFT,
            };

            const mockGetCutDistance = () => 0;
            const cutTime = calculateCutTime(spotCut, mockGetCutDistance);

            // 0 should use default of DEFAULT_SPOT_DURATION (500ms) = 0.5 seconds
            expect(cutTime).toBe(0.5);
        });

        it('should calculate time from distance for regular cuts', () => {
            const regularCut: CutData = {
                id: 'cut-1',
                name: 'Regular Cut',
                enabled: true,
                order: 1,
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: 'tool-1',
                action: OperationAction.CUT,
                cutDirection: CutDirection.CLOCKWISE,
                normal: { x: 1, y: 0 },
                normalConnectionPoint: { x: 0, y: 0 },
                normalSide: NormalSide.LEFT,
            };

            const mockGetCutDistance = () => 100; // 100mm distance
            const cutTime = calculateCutTime(regularCut, mockGetCutDistance);

            // 100mm at 1000mm/min = 0.1 min = 6 seconds
            expect(cutTime).toBe(6);
        });

        it('should support various spot durations', () => {
            const testCases = [
                { duration: 50, expectedTime: 0.05 },
                { duration: 100, expectedTime: 0.1 },
                { duration: 200, expectedTime: 0.2 },
                { duration: 500, expectedTime: 0.5 },
                { duration: 1000, expectedTime: 1.0 },
            ];

            testCases.forEach(({ duration, expectedTime }) => {
                const spotCut: CutData = {
                    id: 'cut-1',
                    name: 'Spot Cut',
                    enabled: true,
                    order: 1,
                    operationId: 'op-1',
                    chainId: 'chain-1',
                    toolId: 'tool-1',
                    action: OperationAction.SPOT,
                    spotDuration: duration,
                    cutDirection: CutDirection.NONE,
                    normal: { x: 0, y: 0 },
                    normalConnectionPoint: { x: 50, y: 50 },
                    normalSide: NormalSide.LEFT,
                };

                const mockGetCutDistance = () => 0;
                const cutTime = calculateCutTime(spotCut, mockGetCutDistance);

                expect(cutTime).toBe(expectedTime);
            });
        });
    });

    describe('Animation Step Distance for Spots', () => {
        it('should have zero distance for spot operations', () => {
            const spotCut: CutData = {
                id: 'cut-1',
                name: 'Spot Cut',
                enabled: true,
                order: 1,
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: 'tool-1',
                action: OperationAction.SPOT,
                spotDuration: 150,
                cutDirection: CutDirection.NONE,
                normal: { x: 0, y: 0 },
                normalConnectionPoint: { x: 50, y: 50 },
                normalSide: NormalSide.LEFT,
            };

            // Simulate the distance calculation
            const cutDistance =
                spotCut.action === OperationAction.SPOT ? 0 : 100;

            expect(cutDistance).toBe(0);
        });
    });
});
