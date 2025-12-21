import { describe, expect, it } from 'vitest';
import {
    Unit,
    convertUnits,
    formatValue,
    getPhysicalScaleFactor,
    getPixelsPerUnit,
    getUnitSymbol,
    getReactiveUnitSymbol,
    measurementSystemToUnit,
    convertCoordinates,
    convertDrawingCoordinates,
} from './units';
import { MeasurementSystem } from '$lib/config/settings/enums';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { GeometryType } from '$lib/geometry/enums';

describe('Units utilities', () => {
    describe('getPixelsPerUnit', () => {
        it('should return correct pixels per mm', () => {
            const pixelsPerMm = getPixelsPerUnit(Unit.MM);
            expect(pixelsPerMm).toBeCloseTo(3.78, 2); // ~96/25.4
        });

        it('should return correct pixels per inch', () => {
            const pixelsPerInch = getPixelsPerUnit(Unit.INCH);
            expect(pixelsPerInch).toBe(96);
        });
    });

    describe('convertUnits', () => {
        it('should convert mm to inches correctly', () => {
            const result = convertUnits(25.4, Unit.MM, Unit.INCH);
            expect(result).toBeCloseTo(1.0, 5);
        });

        it('should convert inches to mm correctly', () => {
            const result = convertUnits(1.0, Unit.INCH, Unit.MM);
            expect(result).toBeCloseTo(25.4, 5);
        });

        it('should return same value for same units', () => {
            expect(convertUnits(10, Unit.MM, Unit.MM)).toBe(10);
            expect(convertUnits(5, Unit.INCH, Unit.INCH)).toBe(5);
        });
    });

    describe('getPhysicalScaleFactor', () => {
        it('should return display unit pixels per unit', () => {
            // When displaying as mm, use mm scale regardless of geometry units
            expect(getPhysicalScaleFactor(Unit.MM, Unit.MM)).toBeCloseTo(
                3.78,
                2
            );
            expect(getPhysicalScaleFactor(Unit.INCH, Unit.MM)).toBeCloseTo(
                3.78,
                2
            );

            // When displaying as inches, use inch scale regardless of geometry units
            expect(getPhysicalScaleFactor(Unit.MM, Unit.INCH)).toBe(96);
            expect(getPhysicalScaleFactor(Unit.INCH, Unit.INCH)).toBe(96);
        });
    });

    describe('formatValue', () => {
        it('should format mm values with 1 decimal place', () => {
            expect(formatValue(12.3456, Unit.MM)).toBe('12.3');
            expect(formatValue(10, Unit.MM)).toBe('10.0');
        });

        it('should format inch values with 4 decimal places (ten-thousandths)', () => {
            expect(formatValue(1.2345678, Unit.INCH)).toBe('1.2346');
            expect(formatValue(2, Unit.INCH)).toBe('2.0000');
            expect(formatValue(0.0001, Unit.INCH)).toBe('0.0001');
        });
    });

    describe('getUnitSymbol', () => {
        it('should return correct symbols', () => {
            expect(getUnitSymbol(Unit.MM)).toBe('mm');
            expect(getUnitSymbol(Unit.INCH)).toBe('in.');
        });
    });

    describe('getReactiveUnitSymbol', () => {
        it('should return correct symbols for measurement systems', () => {
            expect(getReactiveUnitSymbol(MeasurementSystem.Metric)).toBe('mm');
            expect(getReactiveUnitSymbol(MeasurementSystem.Imperial)).toBe(
                'in.'
            );
        });
    });

    describe('measurementSystemToUnit', () => {
        it('should convert MeasurementSystem to Unit enum', () => {
            expect(measurementSystemToUnit(MeasurementSystem.Metric)).toBe(
                Unit.MM
            );
            expect(measurementSystemToUnit(MeasurementSystem.Imperial)).toBe(
                Unit.INCH
            );
        });
    });

    describe('convertCoordinates', () => {
        it('should convert array of coordinates', () => {
            const mmCoords = [25.4, 50.8, 76.2]; // 1", 2", 3" in mm
            const inchCoords = convertCoordinates(mmCoords, Unit.MM, Unit.INCH);

            expect(inchCoords).toHaveLength(3);
            expect(inchCoords[0]).toBeCloseTo(1.0, 5);
            expect(inchCoords[1]).toBeCloseTo(2.0, 5);
            expect(inchCoords[2]).toBeCloseTo(3.0, 5);
        });

        it('should return same array for same units', () => {
            const coords = [10, 20, 30];
            const result = convertCoordinates(coords, Unit.MM, Unit.MM);
            expect(result).toEqual(coords);
        });
    });

    describe('Physical scaling integration', () => {
        it('should display geometry values at display unit physical size', () => {
            // 186.2mm geometry displayed as mm should be 186.2mm on screen
            const geometryValue = 186.2;
            const mmDisplayPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.MM);
            const mmOnScreen = mmDisplayPixels / (96 / 25.4);
            expect(mmOnScreen).toBeCloseTo(186.2, 1);

            // 186.2mm geometry displayed as inches should be 186.2" on screen
            const inchDisplayPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.INCH);
            const inchesOnScreen = inchDisplayPixels / 96;
            expect(inchesOnScreen).toBeCloseTo(186.2, 1);
        });

        it('should scale appropriately when switching display units', () => {
            // Same geometry value should appear different physical sizes based on display unit
            const geometryValue = 100; // Could be 100mm or 100 inches from DXF

            // When displayed as mm: 100 units → 100mm on screen
            const mmPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.MM);
            const mmOnScreen = mmPixels / (96 / 25.4);
            expect(mmOnScreen).toBeCloseTo(100, 1);

            // When displayed as inches: 100 units → 100" on screen
            const inchPixels =
                geometryValue * getPhysicalScaleFactor(Unit.MM, Unit.INCH);
            const inchesOnScreen = inchPixels / 96;
            expect(inchesOnScreen).toBeCloseTo(100, 1);

            // The inch display should be much larger than mm display
            expect(inchPixels).toBeGreaterThan(mmPixels);
        });
    });

    describe('convertDrawingCoordinates', () => {
        it('should convert LINE geometry from mm to inch', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 25.4, y: 50.8 }, // 1", 2" in mm
                        },
                        layer: '0',
                    },
                ],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.MM,
                Unit.INCH
            );

            expect(converted.units).toBe(Unit.INCH);
            expect(converted.shapes.length).toBe(1);
            const line = converted.shapes[0];
            expect((line.geometry as any).start.x).toBeCloseTo(0, 5);
            expect((line.geometry as any).start.y).toBeCloseTo(0, 5);
            expect((line.geometry as any).end.x).toBeCloseTo(1.0, 5);
            expect((line.geometry as any).end.y).toBeCloseTo(2.0, 5);
        });

        it('should convert CIRCLE geometry from inch to mm', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.CIRCLE,
                        geometry: {
                            center: { x: 1.0, y: 2.0 }, // inches
                            radius: 0.5, // 0.5 inches
                        },
                        layer: '0',
                    },
                ],
                units: Unit.INCH,
                fileName: 'test.dxf',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.INCH,
                Unit.MM
            );

            expect(converted.units).toBe(Unit.MM);
            const circle = converted.shapes[0];
            expect((circle.geometry as any).center.x).toBeCloseTo(25.4, 5);
            expect((circle.geometry as any).center.y).toBeCloseTo(50.8, 5);
            expect((circle.geometry as any).radius).toBeCloseTo(12.7, 5);
        });

        it('should convert ARC geometry', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 10, y: 20 },
                            radius: 5,
                            startAngle: 0,
                            endAngle: Math.PI / 2,
                            clockwise: false,
                        },
                        layer: '0',
                    },
                ],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.MM,
                Unit.INCH
            );

            const arc = converted.shapes[0];
            expect((arc.geometry as any).center.x).toBeCloseTo(10 / 25.4, 5);
            expect((arc.geometry as any).center.y).toBeCloseTo(20 / 25.4, 5);
            expect((arc.geometry as any).radius).toBeCloseTo(5 / 25.4, 5);
            // Angles should not be converted
            expect((arc.geometry as any).startAngle).toBe(0);
            expect((arc.geometry as any).endAngle).toBe(Math.PI / 2);
        });

        it('should convert ELLIPSE geometry', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.ELLIPSE,
                        geometry: {
                            center: { x: 100, y: 200 },
                            majorAxisEndpoint: { x: 50, y: 0 },
                            minorToMajorRatio: 0.5,
                            startParam: 0,
                            endParam: Math.PI * 2,
                        },
                        layer: '0',
                    },
                ],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.MM,
                Unit.INCH
            );

            const ellipse = converted.shapes[0];
            expect((ellipse.geometry as any).center.x).toBeCloseTo(
                100 / 25.4,
                5
            );
            expect((ellipse.geometry as any).center.y).toBeCloseTo(
                200 / 25.4,
                5
            );
            expect((ellipse.geometry as any).majorAxisEndpoint.x).toBeCloseTo(
                50 / 25.4,
                5
            );
            expect((ellipse.geometry as any).minorToMajorRatio).toBe(0.5);
        });

        it('should convert SPLINE geometry', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { x: 0, y: 0 },
                                { x: 10, y: 20 },
                                { x: 30, y: 40 },
                            ],
                            knots: [0, 0, 0, 1, 1, 1],
                            weights: [1, 1, 1],
                            degree: 2,
                            fitPoints: [
                                { x: 5, y: 10 },
                                { x: 15, y: 25 },
                            ],
                            closed: false,
                        },
                        layer: '0',
                    },
                ],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.MM,
                Unit.INCH
            );

            const spline = converted.shapes[0];
            expect((spline.geometry as any).controlPoints[1].x).toBeCloseTo(
                10 / 25.4,
                5
            );
            expect((spline.geometry as any).controlPoints[1].y).toBeCloseTo(
                20 / 25.4,
                5
            );
            expect((spline.geometry as any).fitPoints[0].x).toBeCloseTo(
                5 / 25.4,
                5
            );
            expect((spline.geometry as any).fitPoints[0].y).toBeCloseTo(
                10 / 25.4,
                5
            );
        });

        it('should convert POLYLINE geometry recursively', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.POLYLINE,
                        geometry: {
                            closed: true,
                            shapes: [
                                {
                                    id: '2',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 0, y: 0 },
                                        end: { x: 25.4, y: 0 },
                                    },
                                    layer: '0',
                                },
                                {
                                    id: '3',
                                    type: GeometryType.LINE,
                                    geometry: {
                                        start: { x: 25.4, y: 0 },
                                        end: { x: 25.4, y: 50.8 },
                                    },
                                    layer: '0',
                                },
                            ],
                        },
                        layer: '0',
                    },
                ],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.MM,
                Unit.INCH
            );

            const polyline = converted.shapes[0];
            const line1 = (polyline.geometry as any).shapes[0];
            const line2 = (polyline.geometry as any).shapes[1];

            expect((line1.geometry as any).end.x).toBeCloseTo(1.0, 5);
            expect((line2.geometry as any).end.y).toBeCloseTo(2.0, 5);
        });

        it('should not convert when units match', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 200 },
                        },
                        layer: '0',
                    },
                ],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.MM,
                Unit.MM
            );

            expect(converted).toBe(drawing); // Should return same object
        });

        it('should not convert when fromUnit is NONE', () => {
            const drawing: DrawingData = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 100, y: 200 },
                        },
                        layer: '0',
                    },
                ],
                units: Unit.NONE,
                fileName: 'test.svg',
            };

            const converted = convertDrawingCoordinates(
                drawing,
                Unit.NONE,
                Unit.MM
            );

            expect(converted).toBe(drawing); // Should return same object
        });
    });
});
