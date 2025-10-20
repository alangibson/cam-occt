<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import ShapeProperties from './ShapeProperties.svelte';
    import ChainProperties from './ChainProperties.svelte';
    import PartProperties from './PartProperties.svelte';
    import CutProperties from './CutProperties.svelte';
    import LeadProperties from './LeadProperties.svelte';
    import KerfProperties from './KerfProperties.svelte';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { leadStore } from '$lib/stores/leads/store';
    import { kerfStore } from '$lib/stores/kerfs/store';
    import { drawingStore } from '$lib/stores/drawing/store';

    $: selectedChainId = $chainStore.selectedChainId;
    $: selectedPartId = $partStore.selectedPartId;
    $: selectedCutId = $cutStore.selectedCutId;
    $: selectedLeadId = $leadStore.selectedLeadId;
    $: selectedKerfId = $kerfStore.selectedKerfId;
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
    {#if selectedLeadId}
        <LeadProperties />
    {:else if selectedKerfId}
        <KerfProperties />
    {:else if selectedCutId}
        <CutProperties />
    {:else if selectedPartId}
        <PartProperties />
    {:else if selectedChainId}
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
