/**
 * Unified Selection Store
 *
 * Centralized selection management for all entity types in the application.
 * Automatically handles cross-type selection exclusivity.
 */

import { SvelteSet } from 'svelte/reactivity';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { SelectionState } from './interfaces';

class SelectionStore {
    shapes = $state({
        selected: new SvelteSet<string>(),
        hovered: null as string | null,
        selectedOffset: null as ShapeData | null,
    });

    chains = $state({
        selected: new SvelteSet<string>(),
        highlighted: null as string | null,
    });

    parts = $state({
        selected: new SvelteSet<string>(),
        highlighted: null as string | null,
        hovered: null as string | null,
    });

    cuts = $state({
        selected: new SvelteSet<string>(),
        highlighted: null as string | null,
    });

    rapids = $state({
        selected: new SvelteSet<string>(),
        highlighted: null as string | null,
    });

    leads = $state({
        selected: new SvelteSet<string>(),
        highlighted: null as string | null,
    });

    kerfs = $state({
        selected: null as string | null,
        highlighted: null as string | null,
    });

    // Shape selection
    selectShape(shapeIdOrShape: string | ShapeData, multi = false) {
        // Extract ID and full shape object
        const shapeId =
            typeof shapeIdOrShape === 'string'
                ? shapeIdOrShape
                : shapeIdOrShape.id;

        const selected = new SvelteSet(multi ? this.shapes.selected : []);
        selected.add(shapeId);

        this.shapes = {
            ...this.shapes,
            selected,
            selectedOffset: null, // Clear offset selection when selecting regular shapes
        };
    }

    deselectShape(shapeId: string) {
        const selected = new SvelteSet(this.shapes.selected);
        selected.delete(shapeId);
        this.shapes = {
            ...this.shapes,
            selected,
        };
    }

    clearShapeSelection() {
        this.shapes = {
            ...this.shapes,
            selected: new SvelteSet(),
        };
    }

    setHoveredShape(shapeId: string | null) {
        this.shapes = {
            ...this.shapes,
            hovered: shapeId,
        };
    }

    selectOffsetShape(shape: ShapeData | null) {
        this.shapes = {
            ...this.shapes,
            selectedOffset: shape,
            selected: new SvelteSet(), // Clear regular shape selection when selecting offset shape
        };
    }

    clearOffsetShapeSelection() {
        this.shapes = {
            ...this.shapes,
            selectedOffset: null,
        };
    }

    // Chain selection
    selectChain(chainId: string | null, multi = false) {
        if (chainId === null) {
            this.chains = {
                ...this.chains,
                selected: new SvelteSet(),
            };
            return;
        }

        const selected = new SvelteSet(multi ? this.chains.selected : []);
        selected.add(chainId);
        this.chains = {
            ...this.chains,
            selected,
        };
    }

    deselectChain(chainId: string) {
        const selected = new SvelteSet(this.chains.selected);
        selected.delete(chainId);
        this.chains = {
            ...this.chains,
            selected,
        };
    }

    toggleChainSelection(chainId: string) {
        const selected = new SvelteSet(this.chains.selected);
        if (selected.has(chainId)) {
            selected.delete(chainId);
        } else {
            selected.add(chainId);
        }
        this.chains = {
            ...this.chains,
            selected,
        };
    }

    clearChainSelection() {
        this.chains = {
            ...this.chains,
            selected: new SvelteSet(),
        };
    }

    highlightChain(chainId: string | null) {
        this.chains = {
            ...this.chains,
            highlighted: chainId,
        };
    }

    clearChainHighlight() {
        this.chains = {
            ...this.chains,
            highlighted: null,
        };
    }

    // Part selection
    selectPart(partId: string | null, multi = false) {
        if (partId === null) {
            this.parts = {
                ...this.parts,
                selected: new SvelteSet(),
            };
            return;
        }

        const selected = new SvelteSet(multi ? this.parts.selected : []);
        selected.add(partId);
        this.parts = {
            ...this.parts,
            selected,
        };
    }

    deselectPart(partId: string) {
        const selected = new SvelteSet(this.parts.selected);
        selected.delete(partId);
        this.parts = {
            ...this.parts,
            selected,
        };
    }

    togglePartSelection(partId: string) {
        const selected = new SvelteSet(this.parts.selected);
        if (selected.has(partId)) {
            selected.delete(partId);
        } else {
            selected.add(partId);
        }
        this.parts = {
            ...this.parts,
            selected,
        };
    }

    clearPartSelection() {
        this.parts = {
            ...this.parts,
            selected: new SvelteSet(),
        };
    }

    highlightPart(partId: string) {
        this.parts = {
            ...this.parts,
            highlighted: partId,
        };
    }

    clearPartHighlight() {
        this.parts = {
            ...this.parts,
            highlighted: null,
        };
    }

    hoverPart(partId: string | null) {
        this.parts = {
            ...this.parts,
            hovered: partId,
        };
    }

    clearPartHover() {
        this.parts = {
            ...this.parts,
            hovered: null,
        };
    }

    // Cut selection
    selectCut(cutId: string | null, multi = false) {
        if (cutId === null) {
            this.cuts = {
                ...this.cuts,
                selected: new SvelteSet(),
            };
            return;
        }

        const selected = new SvelteSet(multi ? this.cuts.selected : []);
        selected.add(cutId);
        this.cuts = {
            ...this.cuts,
            selected,
        };
    }

    deselectCut(cutId: string) {
        const selected = new SvelteSet(this.cuts.selected);
        selected.delete(cutId);
        this.cuts = {
            ...this.cuts,
            selected,
        };
    }

    toggleCutSelection(cutId: string) {
        const selected = new SvelteSet(this.cuts.selected);
        if (selected.has(cutId)) {
            selected.delete(cutId);
        } else {
            selected.add(cutId);
        }
        this.cuts = {
            ...this.cuts,
            selected,
        };
    }

    clearCutSelection() {
        this.cuts = {
            ...this.cuts,
            selected: new SvelteSet(),
        };
    }

    highlightCut(cutId: string | null) {
        this.cuts = {
            ...this.cuts,
            highlighted: cutId,
        };
    }

    clearCutHighlight() {
        this.cuts = {
            ...this.cuts,
            highlighted: null,
        };
    }

    // Rapid selection
    selectRapids(rapidIds: Set<string>) {
        this.rapids = {
            ...this.rapids,
            selected: new SvelteSet(rapidIds),
        };
    }

    toggleRapidSelection(rapidId: string) {
        const selected = new SvelteSet(this.rapids.selected);
        if (selected.has(rapidId)) {
            selected.delete(rapidId);
        } else {
            selected.add(rapidId);
        }
        this.rapids = {
            ...this.rapids,
            selected,
        };
    }

    clearRapidSelection() {
        this.rapids = {
            ...this.rapids,
            selected: new SvelteSet(),
        };
    }

    highlightRapid(rapidId: string | null) {
        this.rapids = {
            ...this.rapids,
            highlighted: rapidId,
        };
    }

    clearRapidHighlight() {
        this.rapids = {
            ...this.rapids,
            highlighted: null,
        };
    }

    // Lead selection
    selectLead(leadId: string | null, multi = false) {
        if (leadId === null) {
            this.leads = {
                ...this.leads,
                selected: new SvelteSet(),
            };
            return;
        }

        const selected = new SvelteSet(multi ? this.leads.selected : []);
        selected.add(leadId);
        this.leads = {
            ...this.leads,
            selected,
        };
    }

    toggleLeadSelection(leadId: string) {
        const selected = new SvelteSet(this.leads.selected);
        if (selected.has(leadId)) {
            selected.delete(leadId);
        } else {
            selected.add(leadId);
        }
        this.leads = {
            ...this.leads,
            selected,
        };
    }

    clearLeadSelection() {
        this.leads = {
            ...this.leads,
            selected: new SvelteSet(),
        };
    }

    highlightLead(leadId: string | null) {
        this.leads = {
            ...this.leads,
            highlighted: leadId,
        };
    }

    clearLeadHighlight() {
        this.leads = {
            ...this.leads,
            highlighted: null,
        };
    }

    // Kerf selection
    selectKerf(kerfId: string | null) {
        this.kerfs = {
            ...this.kerfs,
            selected: kerfId,
        };
    }

    highlightKerf(kerfId: string | null) {
        this.kerfs = {
            ...this.kerfs,
            highlighted: kerfId,
        };
    }

    clearKerfSelection() {
        this.kerfs = {
            ...this.kerfs,
            selected: null,
        };
    }

    clearKerfHighlight() {
        this.kerfs = {
            ...this.kerfs,
            highlighted: null,
        };
    }

    // Global operations
    clearAllSelections() {
        this.shapes = {
            ...this.shapes,
            selected: new SvelteSet(),
            selectedOffset: null,
        };
        this.chains = { ...this.chains, selected: new SvelteSet() };
        this.parts = { ...this.parts, selected: new SvelteSet() };
        this.cuts = { ...this.cuts, selected: new SvelteSet() };
        this.rapids = { ...this.rapids, selected: new SvelteSet() };
        this.leads = { ...this.leads, selected: new SvelteSet() };
        this.kerfs = { ...this.kerfs, selected: null };
    }

    clearAllHighlights() {
        this.shapes = { ...this.shapes, hovered: null };
        this.chains = { ...this.chains, highlighted: null };
        this.parts = { ...this.parts, highlighted: null, hovered: null };
        this.cuts = { ...this.cuts, highlighted: null };
        this.rapids = { ...this.rapids, highlighted: null };
        this.leads = { ...this.leads, highlighted: null };
        this.kerfs = { ...this.kerfs, highlighted: null };
    }

    reset() {
        this.shapes = {
            selected: new SvelteSet(),
            hovered: null,
            selectedOffset: null,
        };
        this.chains = {
            selected: new SvelteSet(),
            highlighted: null,
        };
        this.parts = {
            selected: new SvelteSet(),
            highlighted: null,
            hovered: null,
        };
        this.cuts = {
            selected: new SvelteSet(),
            highlighted: null,
        };
        this.rapids = {
            selected: new SvelteSet(),
            highlighted: null,
        };
        this.leads = {
            selected: new SvelteSet(),
            highlighted: null,
        };
        this.kerfs = {
            selected: null,
            highlighted: null,
        };
    }

    // Compatibility helper for storage system
    getState(): SelectionState {
        return {
            shapes: this.shapes,
            chains: this.chains,
            parts: this.parts,
            cuts: this.cuts,
            rapids: this.rapids,
            leads: this.leads,
            kerfs: this.kerfs,
        };
    }
}

export const selectionStore = new SelectionStore();
