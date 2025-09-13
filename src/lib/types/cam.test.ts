import { describe, it, expect } from 'vitest';
import {
    CutterCompensation,
    TargetType,
    isCutterCompensation,
    isTargetType,
} from './cam';

describe('CAM Types', () => {
    describe('CutterCompensation enum', () => {
        it('should have correct values', () => {
            expect(CutterCompensation.LEFT_OUTER).toBe('left_outer');
            expect(CutterCompensation.RIGHT_INNER).toBe('right_inner');
            expect(CutterCompensation.OFF).toBe('off');
        });
    });

    describe('TargetType enum', () => {
        it('should have correct values', () => {
            expect(TargetType.PARTS).toBe('parts');
            expect(TargetType.CHAINS).toBe('chains');
        });
    });

    describe('isCutterCompensation', () => {
        it('should return true for valid CutterCompensation values', () => {
            expect(isCutterCompensation(CutterCompensation.LEFT_OUTER)).toBe(
                true
            );
            expect(isCutterCompensation(CutterCompensation.RIGHT_INNER)).toBe(
                true
            );
            expect(isCutterCompensation(CutterCompensation.OFF)).toBe(true);
            expect(isCutterCompensation('left_outer')).toBe(true);
            expect(isCutterCompensation('right_inner')).toBe(true);
            expect(isCutterCompensation('off')).toBe(true);
        });

        it('should return false for invalid values', () => {
            expect(isCutterCompensation('invalid')).toBe(false);
            expect(isCutterCompensation('left_inner')).toBe(false);
            expect(isCutterCompensation('right_outer')).toBe(false);
            expect(isCutterCompensation(null)).toBe(false);
            expect(isCutterCompensation(undefined)).toBe(false);
            expect(isCutterCompensation(123)).toBe(false);
            expect(isCutterCompensation({})).toBe(false);
            expect(isCutterCompensation([])).toBe(false);
            expect(isCutterCompensation('')).toBe(false);
        });
    });

    describe('isTargetType', () => {
        it('should return true for valid TargetType values', () => {
            expect(isTargetType(TargetType.PARTS)).toBe(true);
            expect(isTargetType(TargetType.CHAINS)).toBe(true);
            expect(isTargetType('parts')).toBe(true);
            expect(isTargetType('chains')).toBe(true);
        });

        it('should return false for invalid values', () => {
            expect(isTargetType('invalid')).toBe(false);
            expect(isTargetType('shapes')).toBe(false);
            expect(isTargetType('tools')).toBe(false);
            expect(isTargetType(null)).toBe(false);
            expect(isTargetType(undefined)).toBe(false);
            expect(isTargetType(123)).toBe(false);
            expect(isTargetType({})).toBe(false);
            expect(isTargetType([])).toBe(false);
            expect(isTargetType('')).toBe(false);
        });
    });
});
