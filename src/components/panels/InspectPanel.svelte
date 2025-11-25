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
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { leadStore } from '$lib/stores/leads/store';
    import { kerfStore } from '$lib/stores/kerfs/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { layerStore } from '$lib/stores/layers/store.svelte';

    const selectedChainIds = $derived($chainStore.selectedChainIds);
    const selectedChainId = $derived(
        selectedChainIds.size === 1 ? Array.from(selectedChainIds)[0] : null
    );
    const highlightedChainId = $derived($chainStore.highlightedChainId);
    const hasChainSelection = $derived(
        !!(selectedChainId || highlightedChainId)
    );

    // Debug log for chain selection
    $effect(() => {
        console.log('[InspectPanel] Chain selection changed:', {
            selectedChainIds: Array.from(selectedChainIds),
            selectedChainId,
            highlightedChainId,
            hasChainSelection,
        });
    });

    const selectedPartIds = $derived($partStore.selectedPartIds);
    const selectedPartId = $derived(
        selectedPartIds.size === 1 ? Array.from(selectedPartIds)[0] : null
    );
    const highlightedPartId = $derived($partStore.highlightedPartId);
    const hoveredPartId = $derived($partStore.hoveredPartId);
    const hasPartSelection = $derived(
        !!(selectedPartId || highlightedPartId || hoveredPartId)
    );

    const selectedCutIds = $derived($cutStore.selectedCutIds);
    const selectedCutId = $derived(
        selectedCutIds.size === 1 ? Array.from(selectedCutIds)[0] : null
    );
    const highlightedCutId = $derived($cutStore.highlightedCutId);
    const hasCutSelection = $derived(!!(selectedCutId || highlightedCutId));

    const selectedLeadIds = $derived($leadStore.selectedLeadIds);
    const selectedLeadId = $derived(
        selectedLeadIds.size === 1 ? Array.from(selectedLeadIds)[0] : null
    );
    const highlightedLeadId = $derived($leadStore.highlightedLeadId);
    const hasLeadSelection = $derived(!!(selectedLeadId || highlightedLeadId));

    const selectedKerfId = $derived($kerfStore.selectedKerfId);

    const selectedRapidIds = $derived($rapidStore.selectedRapidIds);
    const selectedRapidId = $derived(
        selectedRapidIds.size === 1 ? Array.from(selectedRapidIds)[0] : null
    );
    const highlightedRapidId = $derived($rapidStore.highlightedRapidId);
    const hasRapidSelection = $derived(
        !!(selectedRapidId || highlightedRapidId)
    );

    const selectedShapes = $derived($drawingStore.selectedShapes);
    const hoveredShape = $derived($drawingStore.hoveredShape);
    const selectedOffsetShape = $derived($drawingStore.selectedOffsetShape);
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
        console.log('[InspectPanel] Selection state:', {
            hasLeadSelection,
            hasRapidSelection,
            selectedKerfId,
            hasCutSelection,
            hasPartSelection,
            hasChainSelection,
            hasShapeSelection,
            hasLayerSelection,
            hasAnySelection,
        });
    });
</script>

<AccordionPanel title="Inspect" isExpanded={hasAnySelection}>
    {#if hasLeadSelection}
        {console.log('[InspectPanel] Rendering LeadProperties')}
        <LeadProperties />
    {:else if hasRapidSelection}
        {console.log('[InspectPanel] Rendering RapidProperties')}
        <RapidProperties />
    {:else if selectedKerfId}
        {console.log(
            '[InspectPanel] Rendering KerfProperties, selectedKerfId:',
            selectedKerfId
        )}
        <KerfProperties />
    {:else if hasCutSelection}
        {console.log('[InspectPanel] Rendering CutProperties')}
        <CutProperties />
    {:else if hasPartSelection}
        {console.log('[InspectPanel] Rendering PartProperties')}
        <PartProperties />
    {:else if hasChainSelection}
        {console.log('[InspectPanel] Rendering ChainProperties')}
        <ChainProperties />
    {:else if hasShapeSelection}
        {console.log('[InspectPanel] Rendering ShapeProperties')}
        <ShapeProperties />
    {:else if hasLayerSelection}
        {console.log('[InspectPanel] Rendering LayerProperties')}
        <LayerProperties />
    {:else}
        {console.log('[InspectPanel] Rendering nothing selected')}
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
