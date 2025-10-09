/**
 * Tests for render state management
 */

import { describe, it, expect } from 'vitest';
import { createEmptyRenderState, cloneRenderState } from './render-state';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { Unit } from '$lib/utils/units';
import type { Chain } from '$lib/geometry/chain/interfaces';

describe('createEmptyRenderState', () => {
    it('should create state with correct default values', () => {
        const state = createEmptyRenderState();

        expect(state.drawing).toBeNull();
        expect(state.transform.zoomScale).toBe(1);
        expect(state.transform.panOffset).toEqual({ x: 0, y: 0 });
        expect(state.transform.unitScale).toBe(1);
        expect(state.selection.selectedShapes).toBeInstanceOf(Set);
        expect(state.selection.selectedShapes.size).toBe(0);
        expect(state.selection.hoveredShape).toBeNull();
        expect(state.hover.mousePosition).toBeNull();
        expect(state.visibility.showRapids).toBe(true);
        expect(state.stage).toBe(WorkflowStage.IMPORT);
        expect(state.displayUnit).toBe(Unit.MM);
        expect(state.chains).toEqual([]);
        expect(state.parts).toEqual([]);
        expect(state.cuts).toEqual([]);
        expect(state.operations).toEqual([]);
        expect(state.rapids).toEqual([]);
        expect(state.respectLayerVisibility).toBe(true);
        expect(state.interactionMode).toBe('shapes');
    });

    it('should create overlays for all workflow stages', () => {
        const state = createEmptyRenderState();

        expect(state.overlays).toHaveProperty(WorkflowStage.IMPORT);
        expect(state.overlays).toHaveProperty(WorkflowStage.EDIT);
        expect(state.overlays).toHaveProperty(WorkflowStage.PREPARE);
        expect(state.overlays).toHaveProperty(WorkflowStage.PROGRAM);
        expect(state.overlays).toHaveProperty(WorkflowStage.SIMULATE);
        expect(state.overlays).toHaveProperty(WorkflowStage.EXPORT);
        expect(state.currentOverlay).toBeNull();
    });

    it('should accept a custom stage parameter', () => {
        const state = createEmptyRenderState(WorkflowStage.PREPARE);
        expect(state.stage).toBe(WorkflowStage.PREPARE);
    });

    it('should default to import stage when no stage is provided', () => {
        const state = createEmptyRenderState();
        expect(state.stage).toBe(WorkflowStage.IMPORT);
    });
});

describe('cloneRenderState', () => {
    it('should create deep copy of render state', () => {
        const originalState = createEmptyRenderState();

        // Add some data to test deep copying
        originalState.transform.zoomScale = 2;
        originalState.transform.panOffset = { x: 10, y: 20 };
        originalState.selection.selectedShapes.add('shape1');
        originalState.selection.selectedShapes.add('shape2');
        originalState.visibility.layerVisibility = {
            layer1: true,
            layer2: false,
        };
        originalState.chains = [{ id: 'chain1' } as Chain];
        originalState.currentOverlay = { shapePoints: [{ x: 1, y: 2 }] };

        const clonedState = cloneRenderState(originalState);

        // Should be different objects
        expect(clonedState).not.toBe(originalState);
        expect(clonedState.transform).not.toBe(originalState.transform);
        expect(clonedState.selection).not.toBe(originalState.selection);
        expect(clonedState.selection.selectedShapes).not.toBe(
            originalState.selection.selectedShapes
        );
        expect(clonedState.hover).not.toBe(originalState.hover);
        expect(clonedState.visibility).not.toBe(originalState.visibility);
        expect(clonedState.visibility.layerVisibility).not.toBe(
            originalState.visibility.layerVisibility
        );
        expect(clonedState.chains).not.toBe(originalState.chains);
        expect(clonedState.currentOverlay).not.toBe(
            originalState.currentOverlay
        );

        // Should have same values
        expect(clonedState.transform.zoomScale).toBe(2);
        expect(clonedState.transform.panOffset).toEqual({ x: 10, y: 20 });
        expect(clonedState.selection.selectedShapes.has('shape1')).toBe(true);
        expect(clonedState.selection.selectedShapes.has('shape2')).toBe(true);
        expect(clonedState.visibility.layerVisibility).toEqual({
            layer1: true,
            layer2: false,
        });
        expect(clonedState.chains).toEqual([{ id: 'chain1' }]);
        expect(clonedState.currentOverlay).toEqual({
            shapePoints: [{ x: 1, y: 2 }],
        });
    });

    it('should handle null currentOverlay', () => {
        const originalState = createEmptyRenderState();
        originalState.currentOverlay = null;

        const clonedState = cloneRenderState(originalState);

        expect(clonedState.currentOverlay).toBeNull();
    });

    it('should create independent Set for selectedShapes', () => {
        const originalState = createEmptyRenderState();
        originalState.selection.selectedShapes.add('shape1');

        const clonedState = cloneRenderState(originalState);

        // Modify clone
        clonedState.selection.selectedShapes.add('shape2');

        // Original should not be affected
        expect(originalState.selection.selectedShapes.has('shape2')).toBe(
            false
        );
        expect(clonedState.selection.selectedShapes.has('shape2')).toBe(true);
    });

    it('should create independent arrays', () => {
        const originalState = createEmptyRenderState();
        originalState.chains = [{ id: 'chain1' } as Chain];

        const clonedState = cloneRenderState(originalState);

        // Modify clone
        clonedState.chains.push({ id: 'chain2' } as Chain);

        // Original should not be affected
        expect(originalState.chains).toHaveLength(1);
        expect(clonedState.chains).toHaveLength(2);
    });
});
