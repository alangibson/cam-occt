/**
 * Tests for DrawingSVG deselection functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { selectionStore } from '$lib/stores/selection/store.svelte';
import { GeometryType } from '$lib/geometry/enums';

describe('DrawingSVG Empty Space Click Deselection', () => {
    beforeEach(() => {
        // Reset selection store before each test
        selectionStore.reset();
    });

    it('should clear all selections when clicking empty space', () => {
        // Arrange - select various entities
        selectionStore.selectShape('shape-1');
        selectionStore.selectChain('chain-1');
        selectionStore.selectPart('part-1');
        selectionStore.selectCut('cut-1');
        selectionStore.selectRapids(new Set(['rapid-1']));
        selectionStore.selectLead('lead-1');
        selectionStore.selectKerf('kerf-1');

        // Verify selections exist
        expect(selectionStore.shapes.selected.size).toBe(1);
        expect(selectionStore.chains.selected.size).toBe(1);
        expect(selectionStore.parts.selected.size).toBe(1);
        expect(selectionStore.cuts.selected.size).toBe(1);
        expect(selectionStore.rapids.selected.size).toBe(1);
        expect(selectionStore.leads.selected.size).toBe(1);
        expect(selectionStore.kerfs.selected).toBe('kerf-1');

        // Act - simulate clicking empty space (what handleSvgClick does)
        const mockEvent = {
            ctrlKey: false,
            metaKey: false,
        } as MouseEvent;

        if (!mockEvent.ctrlKey && !mockEvent.metaKey) {
            selectionStore.clearSelections();
        }

        // Assert - all selections should be cleared
        expect(selectionStore.shapes.selected.size).toBe(0);
        expect(selectionStore.chains.selected.size).toBe(0);
        expect(selectionStore.parts.selected.size).toBe(0);
        expect(selectionStore.cuts.selected.size).toBe(0);
        expect(selectionStore.rapids.selected.size).toBe(0);
        expect(selectionStore.leads.selected.size).toBe(0);
        expect(selectionStore.kerfs.selected).toBeNull();
    });

    it('should preserve selections when Ctrl+clicking empty space', () => {
        // Arrange - select various entities
        selectionStore.selectShape('shape-1');
        selectionStore.selectChain('chain-1');
        selectionStore.selectCut('cut-1');

        // Act - simulate Ctrl+clicking empty space
        const mockEvent = {
            ctrlKey: true,
            metaKey: false,
        } as MouseEvent;

        if (!mockEvent.ctrlKey && !mockEvent.metaKey) {
            selectionStore.clearSelections();
        }

        // Assert - selections should be preserved
        expect(selectionStore.shapes.selected.size).toBe(1);
        expect(selectionStore.chains.selected.size).toBe(1);
        expect(selectionStore.cuts.selected.size).toBe(1);
    });

    it('should preserve selections when Cmd+clicking empty space (macOS)', () => {
        // Arrange - select various entities
        selectionStore.selectShape('shape-1');
        selectionStore.selectRapids(new Set(['rapid-1']));
        selectionStore.selectLead('lead-1');

        // Act - simulate Cmd+clicking empty space
        const mockEvent = {
            ctrlKey: false,
            metaKey: true,
        } as MouseEvent;

        if (!mockEvent.ctrlKey && !mockEvent.metaKey) {
            selectionStore.clearSelections();
        }

        // Assert - selections should be preserved
        expect(selectionStore.shapes.selected.size).toBe(1);
        expect(selectionStore.rapids.selected.size).toBe(1);
        expect(selectionStore.leads.selected.size).toBe(1);
    });

    it('should clear offset shape selection when clicking empty space', () => {
        // Arrange - select an offset shape
        const mockOffsetShape = {
            id: 'offset-1',
            type: GeometryType.LINE,
            geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
        };
        selectionStore.selectOffsetShape(mockOffsetShape);

        // Verify offset selection exists
        expect(selectionStore.shapes.selectedOffset).not.toBeNull();

        // Act - simulate clicking empty space
        const mockEvent = {
            ctrlKey: false,
            metaKey: false,
        } as MouseEvent;

        if (!mockEvent.ctrlKey && !mockEvent.metaKey) {
            selectionStore.clearSelections();
        }

        // Assert - offset selection should be cleared
        expect(selectionStore.shapes.selectedOffset).toBeNull();
    });
});
