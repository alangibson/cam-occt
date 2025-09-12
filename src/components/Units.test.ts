// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Units from './Units.svelte';
import { drawingStore } from '$lib/stores/drawing/store';
import { Unit } from '$lib/utils/units';

describe('Units Component', () => {
    beforeEach(() => {
        // Initialize store with default state
        drawingStore.setDisplayUnit(Unit.MM);
    });

    it('should render without errors', () => {
        const { container } = render(Units);
        expect(container).toBeDefined();
    });

    it('should display current unit from drawing store', () => {
        // Set initial unit
        drawingStore.setDisplayUnit(Unit.MM);

        const { getByRole } = render(Units);
        const dropdown = getByRole('combobox') as HTMLSelectElement;
        expect(dropdown.value).toBe('mm');
    });

    it('should update drawing store when unit is changed', async () => {
        drawingStore.setDisplayUnit(Unit.MM);

        const { getByRole } = render(Units);
        const dropdown = getByRole('combobox') as HTMLSelectElement;

        // Change to inches
        dropdown.value = 'inch';
        await fireEvent.change(dropdown);

        // Verify store was updated
        expect(get(drawingStore).displayUnit).toBe('inch');
    });

    it('should show both mm and inch options', () => {
        const { getByText } = render(Units);

        expect(getByText('Millimeters (mm)')).toBeDefined();
        expect(getByText('Inches (in)')).toBeDefined();
    });

    it('should update reactive selectedUnit when store changes', async () => {
        const { getByRole, rerender } = render(Units);
        const dropdown = getByRole('combobox') as HTMLSelectElement;

        // Initial state
        expect(dropdown.value).toBe('mm'); // Default unit

        // Change store externally
        drawingStore.setDisplayUnit(Unit.INCH);

        // Re-render to get updated store value
        await rerender({});

        // Should react to store change
        expect(dropdown.value).toBe('inch');
    });

    it('should display informational note about units', () => {
        const { getByText } = render(Units);

        const note = getByText(/Units are for display only/);
        expect(note).toBeDefined();
        expect(note.textContent?.replace(/\s+/g, ' ').trim()).toBe(
            'Units are for display only. Changing units will scale the visual size to match physical dimensions but will not modify the underlying geometry.'
        );
    });
});
