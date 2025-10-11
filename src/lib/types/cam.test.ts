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
            expect(CutterCompensation.MACHINE).toBe('machine');
            expect(CutterCompensation.SOFTWARE).toBe('software');
            expect(CutterCompensation.NONE).toBe('none');
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
            expect(isCutterCompensation(CutterCompensation.MACHINE)).toBe(true);
            expect(isCutterCompensation(CutterCompensation.SOFTWARE)).toBe(
                true
            );
            expect(isCutterCompensation(CutterCompensation.NONE)).toBe(true);
            expect(isCutterCompensation('machine')).toBe(true);
            expect(isCutterCompensation('software')).toBe(true);
            expect(isCutterCompensation('none')).toBe(true);
        });

        it('should return false for invalid values', () => {
            expect(isCutterCompensation('invalid')).toBe(false);
            expect(isCutterCompensation('left_inner')).toBe(false);
            expect(isCutterCompensation('right_outer')).toBe(false);
            expect(isCutterCompensation(null as any)).toBe(false);
            expect(isCutterCompensation(undefined as any)).toBe(false);
            expect(isCutterCompensation(123 as any)).toBe(false);
            expect(isCutterCompensation({} as any)).toBe(false);
            expect(isCutterCompensation([] as any)).toBe(false);
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
            expect(isTargetType(null as any)).toBe(false);
            expect(isTargetType(undefined as any)).toBe(false);
            expect(isTargetType(123 as any)).toBe(false);
            expect(isTargetType({} as any)).toBe(false);
            expect(isTargetType([] as any)).toBe(false);
            expect(isTargetType('')).toBe(false);
        });
    });
});
