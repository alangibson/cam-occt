import { describe, expect, it } from 'vitest';
import { FULL_CIRCLE_DEG, HALF_CIRCLE_DEG } from '$lib/geometry/circle';
import {
    AngleUnit,
    CardinalDirection,
    CoordinateSystem,
    CutDirection,
    DEFAULT_COORDINATE_SYSTEM,
    DEFAULT_CUT_DIRECTION,
    DEFAULT_LEAD_TYPE,
    DirectionUtils,
    GeometricDirection,
    LeadType,
    RotationDirection,
    isCutDirection,
    isGeometricDirection,
    isLeadType,
} from './direction';

describe('DirectionUtils', () => {
    describe('cutDirectionToRotation', () => {
        it('should convert CLOCKWISE to CLOCKWISE', () => {
            expect(
                DirectionUtils.cutDirectionToRotation(CutDirection.CLOCKWISE)
            ).toBe(RotationDirection.CLOCKWISE);
        });

        it('should convert COUNTERCLOCKWISE to COUNTERCLOCKWISE', () => {
            expect(
                DirectionUtils.cutDirectionToRotation(
                    CutDirection.COUNTERCLOCKWISE
                )
            ).toBe(RotationDirection.COUNTERCLOCKWISE);
        });

        it('should convert NONE to null', () => {
            expect(
                DirectionUtils.cutDirectionToRotation(CutDirection.NONE)
            ).toBe(null);
        });

        it('should handle invalid input gracefully', () => {
            expect(
                DirectionUtils.cutDirectionToRotation('invalid' as CutDirection)
            ).toBe(null);
        });
    });

    describe('oppositeCutDirection', () => {
        it('should return COUNTERCLOCKWISE for CLOCKWISE', () => {
            expect(
                DirectionUtils.oppositeCutDirection(CutDirection.CLOCKWISE)
            ).toBe(CutDirection.COUNTERCLOCKWISE);
        });

        it('should return CLOCKWISE for COUNTERCLOCKWISE', () => {
            expect(
                DirectionUtils.oppositeCutDirection(
                    CutDirection.COUNTERCLOCKWISE
                )
            ).toBe(CutDirection.CLOCKWISE);
        });

        it('should return NONE for NONE', () => {
            expect(DirectionUtils.oppositeCutDirection(CutDirection.NONE)).toBe(
                CutDirection.NONE
            );
        });

        it('should handle invalid input gracefully', () => {
            expect(
                DirectionUtils.oppositeCutDirection('invalid' as CutDirection)
            ).toBe(CutDirection.NONE);
        });
    });

    describe('angle conversion', () => {
        describe('degreesToRadians', () => {
            it('should convert 0 degrees to 0 radians', () => {
                expect(DirectionUtils.degreesToRadians(0)).toBe(0);
            });

            it('should convert 90 degrees to π/2 radians', () => {
                expect(DirectionUtils.degreesToRadians(90)).toBeCloseTo(
                    Math.PI / 2
                );
            });

            it('should convert 180 degrees to π radians', () => {
                expect(
                    DirectionUtils.degreesToRadians(HALF_CIRCLE_DEG)
                ).toBeCloseTo(Math.PI);
            });

            it('should convert 360 degrees to 2π radians', () => {
                expect(
                    DirectionUtils.degreesToRadians(FULL_CIRCLE_DEG)
                ).toBeCloseTo(2 * Math.PI);
            });

            it('should handle negative angles', () => {
                expect(DirectionUtils.degreesToRadians(-90)).toBeCloseTo(
                    -Math.PI / 2
                );
            });
        });

        describe('radiansToDegrees', () => {
            it('should convert 0 radians to 0 degrees', () => {
                expect(DirectionUtils.radiansToDegrees(0)).toBe(0);
            });

            it('should convert π/2 radians to 90 degrees', () => {
                expect(
                    DirectionUtils.radiansToDegrees(Math.PI / 2)
                ).toBeCloseTo(90);
            });

            it('should convert π radians to 180 degrees', () => {
                expect(DirectionUtils.radiansToDegrees(Math.PI)).toBeCloseTo(
                    HALF_CIRCLE_DEG
                );
            });

            it('should convert 2π radians to 360 degrees', () => {
                expect(
                    DirectionUtils.radiansToDegrees(2 * Math.PI)
                ).toBeCloseTo(FULL_CIRCLE_DEG);
            });

            it('should handle negative angles', () => {
                expect(
                    DirectionUtils.radiansToDegrees(-Math.PI / 2)
                ).toBeCloseTo(-90);
            });
        });
    });

    describe('angle normalization', () => {
        describe('normalizeRadians', () => {
            it('should normalize angle within -π to π range', () => {
                expect(DirectionUtils.normalizeRadians(0)).toBe(0);
                expect(DirectionUtils.normalizeRadians(Math.PI)).toBe(Math.PI);
                expect(DirectionUtils.normalizeRadians(-Math.PI)).toBe(
                    -Math.PI
                );
            });

            it('should wrap angles greater than π', () => {
                expect(
                    DirectionUtils.normalizeRadians(3 * Math.PI)
                ).toBeCloseTo(Math.PI);
                expect(
                    DirectionUtils.normalizeRadians(5 * Math.PI)
                ).toBeCloseTo(Math.PI);
            });

            it('should wrap angles less than -π', () => {
                expect(
                    DirectionUtils.normalizeRadians(-3 * Math.PI)
                ).toBeCloseTo(-Math.PI);
                expect(
                    DirectionUtils.normalizeRadians(-5 * Math.PI)
                ).toBeCloseTo(-Math.PI);
            });

            it('should handle very large positive angles', () => {
                const result = DirectionUtils.normalizeRadians(10 * Math.PI);
                expect(result).toBeCloseTo(0, 10);
                expect(result).toBeGreaterThanOrEqual(-Math.PI);
                expect(result).toBeLessThanOrEqual(Math.PI);
            });

            it('should handle very large negative angles', () => {
                const result = DirectionUtils.normalizeRadians(-10 * Math.PI);
                expect(result).toBeCloseTo(0, 10);
                expect(result).toBeGreaterThanOrEqual(-Math.PI);
                expect(result).toBeLessThanOrEqual(Math.PI);
            });
        });

        describe('normalizeDegrees', () => {
            it('should normalize angle within 0 to 360 range', () => {
                expect(DirectionUtils.normalizeDegrees(0)).toBe(0);
                expect(DirectionUtils.normalizeDegrees(HALF_CIRCLE_DEG)).toBe(
                    HALF_CIRCLE_DEG
                );
                expect(DirectionUtils.normalizeDegrees(FULL_CIRCLE_DEG)).toBe(
                    0
                );
            });

            it('should wrap angles greater than 360', () => {
                expect(DirectionUtils.normalizeDegrees(450)).toBe(90);
                expect(DirectionUtils.normalizeDegrees(720)).toBe(0);
            });

            it('should wrap negative angles', () => {
                expect(DirectionUtils.normalizeDegrees(-90)).toBe(270);
                expect(DirectionUtils.normalizeDegrees(-180)).toBe(180);
                expect(DirectionUtils.normalizeDegrees(-360)).toBe(0);
            });

            it('should handle very large angles', () => {
                expect(DirectionUtils.normalizeDegrees(1800)).toBe(0);
                expect(DirectionUtils.normalizeDegrees(-1800)).toBe(0);
            });
        });
    });

    describe('convertAngle', () => {
        it('should return same angle for same coordinate system', () => {
            expect(
                DirectionUtils.convertAngle(
                    45,
                    AngleUnit.DEGREES,
                    CoordinateSystem.WORLD,
                    CoordinateSystem.WORLD
                )
            ).toBe(45);
            expect(
                DirectionUtils.convertAngle(
                    Math.PI / 4,
                    AngleUnit.RADIANS,
                    CoordinateSystem.SCREEN,
                    CoordinateSystem.SCREEN
                )
            ).toBe(Math.PI / 4);
        });

        it('should convert degrees between world and screen coordinates', () => {
            // World to screen: flip Y (negate angle)
            expect(
                DirectionUtils.convertAngle(
                    90,
                    AngleUnit.DEGREES,
                    CoordinateSystem.WORLD,
                    CoordinateSystem.SCREEN
                )
            ).toBe(-90);

            // Screen to world: flip Y (negate angle)
            expect(
                DirectionUtils.convertAngle(
                    -90,
                    AngleUnit.DEGREES,
                    CoordinateSystem.SCREEN,
                    CoordinateSystem.WORLD
                )
            ).toBe(90);
        });

        it('should convert radians between world and screen coordinates', () => {
            expect(
                DirectionUtils.convertAngle(
                    Math.PI / 2,
                    AngleUnit.RADIANS,
                    CoordinateSystem.WORLD,
                    CoordinateSystem.SCREEN
                )
            ).toBeCloseTo(-Math.PI / 2);

            expect(
                DirectionUtils.convertAngle(
                    -Math.PI / 2,
                    AngleUnit.RADIANS,
                    CoordinateSystem.SCREEN,
                    CoordinateSystem.WORLD
                )
            ).toBeCloseTo(Math.PI / 2);
        });

        it('should handle unit circle coordinate system', () => {
            // Unit circle should behave like world coordinates
            expect(
                DirectionUtils.convertAngle(
                    45,
                    AngleUnit.DEGREES,
                    CoordinateSystem.UNIT_CIRCLE,
                    CoordinateSystem.WORLD
                )
            ).toBe(45);

            expect(
                DirectionUtils.convertAngle(
                    45,
                    AngleUnit.DEGREES,
                    CoordinateSystem.UNIT_CIRCLE,
                    CoordinateSystem.SCREEN
                )
            ).toBe(-45);
        });
    });

    describe('getCardinalVector', () => {
        it('should return correct unit vectors for cardinal directions', () => {
            expect(
                DirectionUtils.getCardinalVector(CardinalDirection.EAST)
            ).toEqual({
                x: 1,
                y: 0,
            });
            expect(
                DirectionUtils.getCardinalVector(CardinalDirection.NORTH)
            ).toEqual({
                x: 0,
                y: 1,
            });
            expect(
                DirectionUtils.getCardinalVector(CardinalDirection.WEST)
            ).toEqual({
                x: -1,
                y: 0,
            });
            expect(
                DirectionUtils.getCardinalVector(CardinalDirection.SOUTH)
            ).toEqual({
                x: 0,
                y: -1,
            });
        });

        it('should return default EAST vector for invalid input', () => {
            expect(
                DirectionUtils.getCardinalVector('invalid' as CardinalDirection)
            ).toEqual({
                x: 1,
                y: 0,
            });
        });
    });

    describe('getCardinalAngle', () => {
        it('should return correct angles for cardinal directions', () => {
            expect(
                DirectionUtils.getCardinalAngle(CardinalDirection.EAST)
            ).toBe(0);
            expect(
                DirectionUtils.getCardinalAngle(CardinalDirection.NORTH)
            ).toBe(Math.PI / 2);
            expect(
                DirectionUtils.getCardinalAngle(CardinalDirection.WEST)
            ).toBe(Math.PI);
            expect(
                DirectionUtils.getCardinalAngle(CardinalDirection.SOUTH)
            ).toBe((3 * Math.PI) / 2);
        });

        it('should return default 0 for invalid input', () => {
            expect(
                DirectionUtils.getCardinalAngle('invalid' as CardinalDirection)
            ).toBe(0);
        });
    });

    describe('validation methods', () => {
        describe('isValidCutDirection', () => {
            it('should validate correct cut directions', () => {
                expect(DirectionUtils.isValidCutDirection('clockwise')).toBe(
                    true
                );
                expect(
                    DirectionUtils.isValidCutDirection('counterclockwise')
                ).toBe(true);
                expect(DirectionUtils.isValidCutDirection('none')).toBe(true);
            });

            it('should reject invalid cut directions', () => {
                expect(DirectionUtils.isValidCutDirection('invalid')).toBe(
                    false
                );
                expect(DirectionUtils.isValidCutDirection('')).toBe(false);
                expect(DirectionUtils.isValidCutDirection('CLOCKWISE')).toBe(
                    false
                );
            });
        });

        describe('isValidLeadType', () => {
            it('should validate correct lead types', () => {
                expect(DirectionUtils.isValidLeadType('arc')).toBe(true);
                expect(DirectionUtils.isValidLeadType('none')).toBe(true);
            });

            it('should reject invalid lead types', () => {
                expect(DirectionUtils.isValidLeadType('invalid')).toBe(false);
                expect(DirectionUtils.isValidLeadType('')).toBe(false);
                expect(DirectionUtils.isValidLeadType('ARC')).toBe(false);
            });
        });
    });

    describe('describeCutDirection', () => {
        it('should provide human-readable descriptions', () => {
            expect(
                DirectionUtils.describeCutDirection(CutDirection.CLOCKWISE)
            ).toBe('Clockwise (CW)');
            expect(
                DirectionUtils.describeCutDirection(
                    CutDirection.COUNTERCLOCKWISE
                )
            ).toBe('Counterclockwise (CCW)');
            expect(DirectionUtils.describeCutDirection(CutDirection.NONE)).toBe(
                'No specific direction'
            );
        });

        it('should handle invalid input gracefully', () => {
            expect(
                DirectionUtils.describeCutDirection('invalid' as CutDirection)
            ).toBe('Unknown direction');
        });
    });
});

describe('Type Guards', () => {
    describe('isLeadType', () => {
        it('should validate LeadType values', () => {
            expect(isLeadType('arc')).toBe(true);
            expect(isLeadType('none')).toBe(true);
            expect(isLeadType('invalid')).toBe(false);
            expect(isLeadType(null as any)).toBe(false);
            expect(isLeadType(undefined as any)).toBe(false);
            expect(isLeadType(123 as any)).toBe(false);
        });
    });

    describe('isCutDirection', () => {
        it('should validate CutDirection values', () => {
            expect(isCutDirection('clockwise')).toBe(true);
            expect(isCutDirection('counterclockwise')).toBe(true);
            expect(isCutDirection('none')).toBe(true);
            expect(isCutDirection('invalid')).toBe(false);
            expect(isCutDirection(null as any)).toBe(false);
            expect(isCutDirection(undefined as any)).toBe(false);
            expect(isCutDirection(123 as any)).toBe(false);
        });
    });

    describe('isGeometricDirection', () => {
        it('should validate GeometricDirection values', () => {
            expect(isGeometricDirection('left')).toBe(true);
            expect(isGeometricDirection('right')).toBe(true);
            expect(isGeometricDirection('up')).toBe(true);
            expect(isGeometricDirection('down')).toBe(true);
            expect(isGeometricDirection('inward')).toBe(true);
            expect(isGeometricDirection('outward')).toBe(true);
            expect(isGeometricDirection('forward')).toBe(true);
            expect(isGeometricDirection('backward')).toBe(true);
            expect(isGeometricDirection('invalid')).toBe(false);
            expect(isGeometricDirection(null as any)).toBe(false);
            expect(isGeometricDirection(undefined as any)).toBe(false);
        });
    });
});

describe('Enums', () => {
    it('should have correct CutDirection values', () => {
        expect(CutDirection.CLOCKWISE).toBe('clockwise');
        expect(CutDirection.COUNTERCLOCKWISE).toBe('counterclockwise');
        expect(CutDirection.NONE).toBe('none');
    });

    it('should have correct LeadType values', () => {
        expect(LeadType.ARC).toBe('arc');
        expect(LeadType.NONE).toBe('none');
    });

    it('should have correct GeometricDirection values', () => {
        expect(GeometricDirection.LEFT).toBe('left');
        expect(GeometricDirection.RIGHT).toBe('right');
        expect(GeometricDirection.UP).toBe('up');
        expect(GeometricDirection.DOWN).toBe('down');
        expect(GeometricDirection.INWARD).toBe('inward');
        expect(GeometricDirection.OUTWARD).toBe('outward');
        expect(GeometricDirection.FORWARD).toBe('forward');
        expect(GeometricDirection.BACKWARD).toBe('backward');
    });

    it('should have correct CoordinateSystem values', () => {
        expect(CoordinateSystem.SCREEN).toBe('screen');
        expect(CoordinateSystem.WORLD).toBe('world');
        expect(CoordinateSystem.UNIT_CIRCLE).toBe('unit');
    });

    it('should have correct AngleUnit values', () => {
        expect(AngleUnit.DEGREES).toBe('degrees');
        expect(AngleUnit.RADIANS).toBe('radians');
    });

    it('should have correct CardinalDirection values', () => {
        expect(CardinalDirection.NORTH).toBe('north');
        expect(CardinalDirection.EAST).toBe('east');
        expect(CardinalDirection.SOUTH).toBe('south');
        expect(CardinalDirection.WEST).toBe('west');
    });

    it('should have correct RotationDirection values', () => {
        expect(RotationDirection.CLOCKWISE).toBe('clockwise');
        expect(RotationDirection.COUNTERCLOCKWISE).toBe('counterclockwise');
    });
});

describe('Default Values', () => {
    it('should have correct default values', () => {
        expect(DEFAULT_CUT_DIRECTION).toBe(CutDirection.NONE);
        expect(DEFAULT_LEAD_TYPE).toBe(LeadType.NONE);
        expect(DEFAULT_COORDINATE_SYSTEM).toBe(CoordinateSystem.WORLD);
    });
});

describe('Edge Cases and Mathematical Properties', () => {
    describe('angle conversion precision', () => {
        it('should maintain precision in conversion round trips', () => {
            const testAngles = [
                0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300,
                315, 330,
            ];

            for (const degrees of testAngles) {
                const radians = DirectionUtils.degreesToRadians(degrees);
                const backToDegrees = DirectionUtils.radiansToDegrees(radians);
                expect(backToDegrees).toBeCloseTo(degrees, 10);
            }
        });

        it('should handle very small angles', () => {
            expect(DirectionUtils.degreesToRadians(0.001)).toBeCloseTo(
                (0.001 * Math.PI) / 180
            );
            expect(DirectionUtils.radiansToDegrees(0.001)).toBeCloseTo(
                (0.001 * 180) / Math.PI
            );
        });
    });

    describe('normalization edge cases', () => {
        it('should handle angles exactly at boundaries', () => {
            expect(DirectionUtils.normalizeRadians(Math.PI)).toBe(Math.PI);
            expect(DirectionUtils.normalizeRadians(-Math.PI)).toBe(-Math.PI);
            expect(DirectionUtils.normalizeDegrees(360)).toBe(0);
            expect(DirectionUtils.normalizeDegrees(0)).toBe(0);
        });

        it('should handle multiple wraps', () => {
            expect(DirectionUtils.normalizeRadians(7 * Math.PI)).toBeCloseTo(
                Math.PI
            );
            expect(DirectionUtils.normalizeDegrees(1080)).toBe(0);
        });
    });

    describe('coordinate system conversion edge cases', () => {
        it('should handle zero angle conversions', () => {
            expect(
                DirectionUtils.convertAngle(
                    0,
                    AngleUnit.DEGREES,
                    CoordinateSystem.WORLD,
                    CoordinateSystem.SCREEN
                )
            ).toBeCloseTo(0);
            expect(
                DirectionUtils.convertAngle(
                    0,
                    AngleUnit.RADIANS,
                    CoordinateSystem.SCREEN,
                    CoordinateSystem.WORLD
                )
            ).toBeCloseTo(0);
        });

        it('should handle π angle conversions', () => {
            expect(
                DirectionUtils.convertAngle(
                    Math.PI,
                    AngleUnit.RADIANS,
                    CoordinateSystem.WORLD,
                    CoordinateSystem.SCREEN
                )
            ).toBeCloseTo(-Math.PI);
        });

        it('should maintain precision in coordinate system round trips', () => {
            const testAngles = [
                0,
                Math.PI / 6,
                Math.PI / 4,
                Math.PI / 3,
                Math.PI / 2,
                Math.PI,
                (3 * Math.PI) / 2,
            ];

            for (const radians of testAngles) {
                const screenAngle = DirectionUtils.convertAngle(
                    radians,
                    AngleUnit.RADIANS,
                    CoordinateSystem.WORLD,
                    CoordinateSystem.SCREEN
                );
                const backToWorld = DirectionUtils.convertAngle(
                    screenAngle,
                    AngleUnit.RADIANS,
                    CoordinateSystem.SCREEN,
                    CoordinateSystem.WORLD
                );
                expect(backToWorld).toBeCloseTo(radians, 10);
            }
        });
    });
});
