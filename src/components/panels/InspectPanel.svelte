<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import ShapeProperties from './ShapeProperties.svelte';
    import ChainProperties from './ChainProperties.svelte';
    import PartProperties from './PartProperties.svelte';
    import CutProperties from './CutProperties.svelte';
    import LeadProperties from './LeadProperties.svelte';
    import KerfProperties from './KerfProperties.svelte';
    import RapidProperties from './RapidProperties.svelte';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { leadStore } from '$lib/stores/leads/store';
    import { kerfStore } from '$lib/stores/kerfs/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import { drawingStore } from '$lib/stores/drawing/store';

    $: selectedChainIds = $chainStore.selectedChainIds;
    $: selectedChainId =
        selectedChainIds.size === 1 ? Array.from(selectedChainIds)[0] : null;
    $: highlightedChainId = $chainStore.highlightedChainId;
    $: hasChainSelection = !!(selectedChainId || highlightedChainId);

    $: selectedPartIds = $partStore.selectedPartIds;
    $: selectedPartId =
        selectedPartIds.size === 1 ? Array.from(selectedPartIds)[0] : null;
    $: highlightedPartId = $partStore.highlightedPartId;
    $: hoveredPartId = $partStore.hoveredPartId;
    $: hasPartSelection = !!(
        selectedPartId ||
        highlightedPartId ||
        hoveredPartId
    );

    $: selectedCutIds = $cutStore.selectedCutIds;
    $: selectedCutId =
        selectedCutIds.size === 1 ? Array.from(selectedCutIds)[0] : null;
    $: highlightedCutId = $cutStore.highlightedCutId;
    $: hasCutSelection = !!(selectedCutId || highlightedCutId);

    $: selectedLeadIds = $leadStore.selectedLeadIds;
    $: selectedLeadId =
        selectedLeadIds.size === 1 ? Array.from(selectedLeadIds)[0] : null;
    $: highlightedLeadId = $leadStore.highlightedLeadId;
    $: hasLeadSelection = !!(selectedLeadId || highlightedLeadId);

    $: selectedKerfId = $kerfStore.selectedKerfId;

    $: selectedRapidIds = $rapidStore.selectedRapidIds;
    $: selectedRapidId =
        selectedRapidIds.size === 1 ? Array.from(selectedRapidIds)[0] : null;
    $: highlightedRapidId = $rapidStore.highlightedRapidId;
    $: hasRapidSelection = !!(selectedRapidId || highlightedRapidId);

    $: selectedShapes = $drawingStore.selectedShapes;
    $: hoveredShape = $drawingStore.hoveredShape;
    $: selectedOffsetShape = $drawingStore.selectedOffsetShape;
    $: hasShapeSelection = !!(
        selectedShapes.size > 0 ||
        hoveredShape ||
        selectedOffsetShape
    );
</script>

<AccordionPanel title="Inspect" isExpanded={false}>
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
