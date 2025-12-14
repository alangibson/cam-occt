<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import ShapeProperties from './ShapeProperties.svelte';
    import LayerProperties from './LayerProperties.svelte';
    import ChainProperties from './ChainProperties.svelte';
    import PartProperties from './PartProperties.svelte';
    import CutProperties from './CutProperties.svelte';
    import LeadProperties from './LeadProperties.svelte';
    import KerfProperties from './KerfProperties.svelte';
    import RapidProperties from './RapidProperties.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { layerStore } from '$lib/stores/layers/store.svelte';

    const selectedChainIds = $derived(selectionStore.chains.selected);
    const selectedChainId = $derived(
        selectedChainIds.size === 1 ? Array.from(selectedChainIds)[0] : null
    );
    const highlightedChainId = $derived(selectionStore.chains.highlighted);
    const hasChainSelection = $derived(
        !!(selectedChainId || highlightedChainId)
    );

    // Track chain selection changes
    $effect(() => {
        void selectedChainIds;
        void selectedChainId;
        void highlightedChainId;
        void hasChainSelection;
    });

    const selectedPartIds = $derived(selectionStore.parts.selected);
    const selectedPartId = $derived(
        selectedPartIds.size === 1 ? Array.from(selectedPartIds)[0] : null
    );
    const highlightedPartId = $derived(selectionStore.parts.highlighted);
    const hoveredPartId = $derived(selectionStore.parts.hovered);
    const hasPartSelection = $derived(
        !!(selectedPartId || highlightedPartId || hoveredPartId)
    );

    const selectedCutIds = $derived(selectionStore.cuts.selected);
    const selectedCutId = $derived(
        selectedCutIds.size === 1 ? Array.from(selectedCutIds)[0] : null
    );
    const highlightedCutId = $derived(selectionStore.cuts.highlighted);
    const hasCutSelection = $derived(!!(selectedCutId || highlightedCutId));

    const selectedLeadIds = $derived(selectionStore.leads.selected);
    const selectedLeadId = $derived(
        selectedLeadIds.size === 1 ? Array.from(selectedLeadIds)[0] : null
    );
    const highlightedLeadId = $derived(selectionStore.leads.highlighted);
    const hasLeadSelection = $derived(!!(selectedLeadId || highlightedLeadId));

    const selectedKerfId = $derived(selectionStore.kerfs.selected);

    const selectedRapidIds = $derived(selectionStore.rapids.selected);
    const selectedRapidId = $derived(
        selectedRapidIds.size === 1 ? Array.from(selectedRapidIds)[0] : null
    );
    const highlightedRapidId = $derived(selectionStore.rapids.highlighted);
    const hasRapidSelection = $derived(
        !!(selectedRapidId || highlightedRapidId)
    );

    const selectedShapes = $derived(selectionStore.shapes.selected);
    const hoveredShape = $derived(selectionStore.shapes.hovered);
    const selectedOffsetShape = $derived(selectionStore.shapes.selectedOffset);
    const hasShapeSelection = $derived(
        !!(selectedShapes.size > 0 || hoveredShape || selectedOffsetShape)
    );

    const selectedLayerId = $derived(layerStore.selectedLayerId);
    const highlightedLayerId = $derived(layerStore.highlightedLayerId);
    const hasLayerSelection = $derived(
        !!(selectedLayerId || highlightedLayerId)
    );

    const hasAnySelection = $derived(
        hasLeadSelection ||
            hasRapidSelection ||
            !!selectedKerfId ||
            hasCutSelection ||
            hasPartSelection ||
            hasChainSelection ||
            hasShapeSelection ||
            hasLayerSelection
    );

    $effect(() => {
        void hasLeadSelection;
        void hasRapidSelection;
        void selectedKerfId;
        void hasCutSelection;
        void hasPartSelection;
        void hasChainSelection;
        void hasShapeSelection;
        void hasLayerSelection;
        void hasAnySelection;
    });
</script>

<AccordionPanel title="Inspect" isExpanded={hasAnySelection}>
    {#if hasLeadSelection}
        <LeadProperties />
    {:else if hasRapidSelection}
        <RapidProperties />
    {:else if selectedKerfId}
        <KerfProperties />
    {:else if hasCutSelection}
        <CutProperties />
    {:else if hasPartSelection}
        <PartProperties />
    {:else if hasChainSelection}
        <ChainProperties />
    {:else if hasShapeSelection}
        <ShapeProperties />
    {:else if hasLayerSelection}
        <LayerProperties />
    {:else}
        <p class="no-selection">Nothing selected</p>
    {/if}
</AccordionPanel>

<style>
    .no-selection {
        color: #666;
        font-style: italic;
        margin: 0;
        text-align: center;
        padding: 1rem;
    }
</style>
