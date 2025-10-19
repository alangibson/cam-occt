import { describe, it, expect } from 'vitest';
import {
    getToolFeedRate,
    getToolPierceHeight,
    getToolCutHeight,
    getToolKerfWidth,
    getToolPuddleJumpHeight,
    getToolPlungeRate,
} from './tool-units';
import { Unit } from './units';
import type { Tool } from '$lib/cam/tool/interfaces';

describe('Tool Units Utilities', () => {
    const mockTool: Tool = {
        id: 'test-tool',
        toolNumber: 1,
        toolName: 'Test Tool',
        feedRate: 1000, // mm/min
        feedRateMetric: 1000, // mm/min
        feedRateImperial: 40, // in/min
        pierceHeight: 3.8, // mm
        pierceHeightMetric: 3.8, // mm
        pierceHeightImperial: 0.15, // in
        cutHeight: 1.5, // mm
        cutHeightMetric: 1.5, // mm
        cutHeightImperial: 0.06, // in
        pierceDelay: 0.5,
        arcVoltage: 120,
        kerfWidth: 1.5, // mm
        kerfWidthMetric: 1.5, // mm
        kerfWidthImperial: 0.06, // in
        thcEnable: true,
        gasPressure: 4.5,
        pauseAtEnd: 0,
        puddleJumpHeight: 0.5, // mm
        puddleJumpHeightMetric: 0.5, // mm
        puddleJumpHeightImperial: 0.02, // in
        puddleJumpDelay: 0,
        plungeRate: 500, // mm/min
        plungeRateMetric: 500, // mm/min
        plungeRateImperial: 20, // in/min
    };

    describe('getToolFeedRate', () => {
        it('should return metric feed rate when display unit is mm', () => {
            const feedRate = getToolFeedRate(mockTool, Unit.MM);
            expect(feedRate).toBe(1000);
        });

        it('should return imperial feed rate when display unit is inch', () => {
            const feedRate = getToolFeedRate(mockTool, Unit.INCH);
            expect(feedRate).toBe(40);
        });
    });

    describe('getToolPierceHeight', () => {
        it('should return metric pierce height when display unit is mm', () => {
            const pierceHeight = getToolPierceHeight(mockTool, Unit.MM);
            expect(pierceHeight).toBe(3.8);
        });

        it('should return imperial pierce height when display unit is inch', () => {
            const pierceHeight = getToolPierceHeight(mockTool, Unit.INCH);
            expect(pierceHeight).toBe(0.15);
        });
    });

    describe('getToolCutHeight', () => {
        it('should return metric cut height when display unit is mm', () => {
            const cutHeight = getToolCutHeight(mockTool, Unit.MM);
            expect(cutHeight).toBe(1.5);
        });

        it('should return imperial cut height when display unit is inch', () => {
            const cutHeight = getToolCutHeight(mockTool, Unit.INCH);
            expect(cutHeight).toBe(0.06);
        });
    });

    describe('getToolKerfWidth', () => {
        it('should return metric kerf width when display unit is mm', () => {
            const kerfWidth = getToolKerfWidth(mockTool, Unit.MM);
            expect(kerfWidth).toBe(1.5);
        });

        it('should return imperial kerf width when display unit is inch', () => {
            const kerfWidth = getToolKerfWidth(mockTool, Unit.INCH);
            expect(kerfWidth).toBe(0.06);
        });
    });

    describe('getToolPuddleJumpHeight', () => {
        it('should return metric puddle jump height when display unit is mm', () => {
            const puddleJumpHeight = getToolPuddleJumpHeight(mockTool, Unit.MM);
            expect(puddleJumpHeight).toBe(0.5);
        });

        it('should return imperial puddle jump height when display unit is inch', () => {
            const puddleJumpHeight = getToolPuddleJumpHeight(
                mockTool,
                Unit.INCH
            );
            expect(puddleJumpHeight).toBe(0.02);
        });
    });

    describe('getToolPlungeRate', () => {
        it('should return metric plunge rate when display unit is mm', () => {
            const plungeRate = getToolPlungeRate(mockTool, Unit.MM);
            expect(plungeRate).toBe(500);
        });

        it('should return imperial plunge rate when display unit is inch', () => {
            const plungeRate = getToolPlungeRate(mockTool, Unit.INCH);
            expect(plungeRate).toBe(20);
        });
    });

    describe('fallback behavior', () => {
        const toolWithoutImperial: Tool = {
            ...mockTool,
            feedRateImperial: undefined,
            pierceHeightImperial: undefined,
            cutHeightImperial: undefined,
            kerfWidthImperial: undefined,
            puddleJumpHeightImperial: undefined,
            plungeRateImperial: undefined,
        };

        it('should convert from metric when imperial values are not available', () => {
            // Feed rate: 1000mm/min ≈ 39.37 in/min
            const feedRate = getToolFeedRate(toolWithoutImperial, Unit.INCH);
            expect(feedRate).toBeCloseTo(39.37, 2);

            // Pierce height: 3.8mm ≈ 0.1496 in
            const pierceHeight = getToolPierceHeight(
                toolWithoutImperial,
                Unit.INCH
            );
            expect(pierceHeight).toBeCloseTo(0.1496, 4);
        });

        const toolWithoutMetric: Tool = {
            ...mockTool,
            feedRateMetric: undefined,
            pierceHeightMetric: undefined,
            cutHeightMetric: undefined,
            kerfWidthMetric: undefined,
            puddleJumpHeightMetric: undefined,
            plungeRateMetric: undefined,
        };

        it('should use main values when metric values are not available', () => {
            const feedRate = getToolFeedRate(toolWithoutMetric, Unit.MM);
            expect(feedRate).toBe(1000); // Uses main feedRate field

            const pierceHeight = getToolPierceHeight(
                toolWithoutMetric,
                Unit.MM
            );
            expect(pierceHeight).toBe(3.8); // Uses main pierceHeight field
        });
    });
});
