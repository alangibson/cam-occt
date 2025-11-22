import { describe, it, expect } from 'vitest';
import { Drawing } from './classes.svelte';
import type { DrawingData } from './interfaces';
import { Unit } from '$lib/config/units/units';

describe('Drawing class', () => {
    describe('toData()', () => {
        it('should serialize all DrawingData fields including fileName', () => {
            const drawingData: DrawingData = {
                shapes: [],
                units: Unit.MM,
                fileName: 'test-drawing.dxf',
            };

            const drawing = new Drawing(drawingData);

            const serialized = drawing.toData();

            expect(serialized).toEqual({
                shapes: [],
                units: Unit.MM,
                fileName: 'test-drawing.dxf',
            });
        });

        it('should include fileName even when modified after construction', () => {
            const drawingData: DrawingData = {
                shapes: [],
                units: Unit.MM,
                fileName: '',
            };

            const drawing = new Drawing(drawingData);
            drawing.fileName = 'modified-name.dxf';

            const serialized = drawing.toData();

            expect(serialized.fileName).toBe('modified-name.dxf');
        });

        it('should handle missing fileName gracefully', () => {
            const drawingData: DrawingData = {
                shapes: [],
                units: Unit.MM,
                fileName: '',
            };

            const drawing = new Drawing(drawingData);

            const serialized = drawing.toData();

            expect(serialized.fileName).toBe('');
        });
    });
});
