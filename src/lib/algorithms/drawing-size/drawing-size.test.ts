import { describe, expect, it } from 'vitest';
import { calculateDrawingSize } from './drawing-size';
import type { Drawing } from '$lib/geometry/shape';
import { Unit } from '$lib/config/units/units';
import { GeometryType } from '$lib/geometry/shape';

describe('calculateDrawingSize', () => {
    it('returns null for empty drawing', () => {
        expect(calculateDrawingSize(null)).toBeNull();
    });

    it('returns null for drawing with no shapes', () => {
        const drawing: Drawing = {
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
            units: Unit.MM,
        };

        expect(calculateDrawingSize(drawing)).toBeNull();
    });

    it('uses DXF bounds when valid', () => {
        const drawing: Drawing = {
            shapes: [
                {
                    id: 'test',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 50 } },
            units: Unit.MM,
        };

        const result = calculateDrawingSize(drawing);
        expect(result).toEqual({
            width: 100,
            height: 50,
            units: Unit.MM,
            source: 'calculated',
        });
    });

    it('falls back to calculated bounds when DXF bounds invalid', () => {
        const drawing: Drawing = {
            shapes: [
                {
                    id: 'test',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 5, y: 10 }, end: { x: 15, y: 20 } },
                },
            ],
            bounds: { min: { x: NaN, y: 0 }, max: { x: 100, y: 50 } },
            units: Unit.INCH,
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
