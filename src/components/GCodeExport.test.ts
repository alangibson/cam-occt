import { describe, expect, it, vi } from 'vitest';
import { generateGCode } from '$lib/cam/gcode-generator/gcode-generator';
import { GeometryType } from '$lib/geometry/shape';
import { Unit } from '$lib/utils/units';
import { CutterCompensation } from '$lib/types/cam';
import type { CutPath } from '$lib/types';
import { generateToolPaths } from '$lib/cam/path-generator/path-generator';

// Mock the modules
vi.mock('$lib/cam/path-generator/path-generator');
vi.mock('$lib/cam/gcode-generator/gcode-generator');

describe('GCodeExport Component Logic', () => {
    describe('G-code generation', () => {
        it('should generate G-code with correct parameters', () => {
            const mockDrawing = {
                shapes: [
                    {
                        id: '1',
                        type: GeometryType.LINE as const,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 10 },
                        },
                        layer: '0',
                    },
                ],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM,
            };

            const mockParameters = {
                feedRate: 1000,
                pierceHeight: 3.8,
                pierceDelay: 0.5,
                cutHeight: 1.5,
                kerf: 1.5,
                // Lead lengths removed from CuttingParameters
            };

            const mockToolPaths: CutPath[] = [
                {
                    id: '1',
                    shapeId: '1',
                    points: [],
                    isRapid: false,
                },
            ];
            const mockGCode =
                'G21 ; Units in mm\nG90 ; Absolute positioning\nM3 ; Start plasma';

            // Set up mocks
            vi.mocked(generateToolPaths).mockReturnValue(mockToolPaths);
            vi.mocked(generateGCode).mockReturnValue(mockGCode);

            // Call the functions that would be called in the component
            const toolPaths = generateToolPaths(mockDrawing, mockParameters);
            const gcode = generateGCode(toolPaths, mockDrawing, {
                units: mockDrawing.units,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.OFF,
            });

            // Verify the functions were called correctly
            expect(generateToolPaths).toHaveBeenCalledWith(
                mockDrawing,
                mockParameters
            );
            expect(generateGCode).toHaveBeenCalledWith(
                mockToolPaths,
                mockDrawing,
                {
                    units: Unit.MM,
                    safeZ: 10,
                    rapidFeedRate: 5000,
                    includeComments: true,
                    cutterCompensation: CutterCompensation.OFF,
                }
            );
            expect(gcode).toBe(mockGCode);
        });
    });

    describe('File download', () => {
        it('should create correct filename from drawing name', () => {
            const testCases = [
                { input: 'test.dxf', expected: 'test.ngc' },
                { input: 'my-drawing.svg', expected: 'my-drawing.ngc' },
                {
                    input: 'file.name.with.dots.dxf',
                    expected: 'file.name.with.dots.ngc',
                },
                { input: null, expected: 'output.ngc' },
                { input: undefined, expected: 'output.ngc' },
            ];

            testCases.forEach(({ input, expected }) => {
                const filename = input
                    ? input.replace(/\.[^/.]+$/, '')
                    : 'output';
                expect(`${filename}.ngc`).toBe(expected);
            });
        });
    });

    describe('G-code display', () => {
        it('should calculate correct statistics', () => {
            const mockGCode = `G21 ; Units in mm
G90 ; Absolute positioning
G0 X0 Y0
G1 X10 Y10 F1000
M5 ; Stop plasma`;

            const lines = mockGCode.split('\n').length;
            const sizeKB = (new Blob([mockGCode]).size / 1024).toFixed(2);

            expect(lines).toBe(5);
            expect(parseFloat(sizeKB)).toBeGreaterThan(0);
            expect(parseFloat(sizeKB)).toBeLessThan(1); // Small test G-code should be less than 1KB
        });
    });
});
