import { describe, expect, it } from 'vitest';
import { calculateDrawingSize } from './drawing-size';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Unit } from '$lib/config/units/units';
import { GeometryType } from '$lib/geometry/enums';

describe('calculateDrawingSize', () => {
    it('returns null for empty drawing', () => {
        expect(calculateDrawingSize(null)).toBeNull();
    });

    it('returns null for drawing with no shapes', () => {
        const drawing: DrawingData = {
            shapes: [],
            units: Unit.MM,
            fileName: '',
        };

        expect(calculateDrawingSize(drawing)).toBeNull();
    });

    it('calculates bounds from shapes', () => {
        const drawing: DrawingData = {
            shapes: [
                {
                    id: 'test',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 50 } },
                },
            ],
            units: Unit.MM,
            fileName: '',
        };

        const result = calculateDrawingSize(drawing);
        expect(result).toEqual({
            width: 100,
            height: 50,
            units: Unit.MM,
            source: 'calculated',
        });
    });

    it('calculates bounds with inch units', () => {
        const drawing: DrawingData = {
            shapes: [
                {
                    id: 'test',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 5, y: 10 }, end: { x: 15, y: 20 } },
                },
            ],
            units: Unit.INCH,
            fileName: '',
        };

        const result = calculateDrawingSize(drawing);
        expect(result).toEqual({
            width: 10,
            height: 10,
            units: Unit.INCH,
            source: 'calculated',
        });
    });
});
