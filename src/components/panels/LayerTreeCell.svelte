<script lang="ts">
    /**
     * Custom cell component for the LayersList tree grid
     * Handles hover events to highlight entities on the canvas
     */

    import { selectionStore } from '$lib/stores/selection/store';
    import { layerStore } from '$lib/stores/layers/store.svelte';
    import type { ICellProps } from '@svar-ui/svelte-grid';

    // SVAR Grid passes all ICellProps, but we only use row and column
    let { row, column }: ICellProps = $props();

    function handleMouseEnter() {
        if (!row) return;

        const rowId = String(row.id ?? '');

        // Ignore container rows and root rows (but not layer rows)
        const isContainer =
            rowId === 'drawing' ||
            rowId === 'plan' ||
            rowId === 'layers' ||
            rowId === 'cuts' ||
            rowId.startsWith('shapes-') ||
            rowId.startsWith('chains-') ||
            rowId.startsWith('parts-') ||
            rowId.endsWith('-chains') ||
            rowId.endsWith('-voids');

        if (isContainer) {
            return;
        }

        // Handle layer hover - highlight the layer
        if (row.layerName && typeof row.layerName === 'string') {
            layerStore.highlightLayer(row.layerName);
            return;
        }

        // Handle different entity types
        if (row.cutId && typeof row.cutId === 'string') {
            // Highlight cut
            selectionStore.highlightCut(row.cutId);
        } else if (row.rapidInId && typeof row.rapidInId === 'string') {
            // Highlight rapid
            selectionStore.highlightRapid(row.rapidInId);
        } else if (
            row.shellChainId ||
            row.voidChainId ||
            row.slotChainId ||
            row.chainId ||
            row.cutChainId
        ) {
            // Highlight chain
            const chainId = (row.shellChainId ||
                row.voidChainId ||
                row.slotChainId ||
                row.chainId ||
                row.cutChainId) as string | undefined;
            selectionStore.highlightChain(chainId ?? null);
        } else if (row.partId && typeof row.partId === 'string') {
            // Hover part
            selectionStore.hoverPart(row.partId);
        } else if (row.shapeId && typeof row.shapeId === 'string') {
            // Hover shape (from chain children)
            selectionStore.setHoveredShape(row.shapeId);
        } else if (
            typeof row.type === 'string' &&
            row.type.startsWith('Shape<')
        ) {
            // Hover shape (from Shapes folder - use row id directly)
            selectionStore.setHoveredShape(rowId);
        }
    }

    function handleMouseLeave() {
        // Clear all hover highlights
        layerStore.clearHighlight();
        selectionStore.setHoveredShape(null);
        selectionStore.highlightChain(null);
        selectionStore.hoverPart(null);
        selectionStore.highlightCut(null);
        selectionStore.highlightRapid(null);
        selectionStore.highlightLead(null);
        selectionStore.highlightKerf(null);
    }
</script>

<div
    class="layer-tree-cell"
    role="gridcell"
    tabindex="-1"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
>
    {column.id ? row[column.id] ?? '' : ''}
</div>

<style>
    .layer-tree-cell {
        width: 100%;
        height: 100%;
        padding: 4px 8px;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        box-sizing: border-box;
    }
</style>
