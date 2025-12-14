<script lang="ts">
    import type { Cut } from '$lib/cam/cut/classes.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { SelectionMode } from '$lib/config/settings/enums';
    import StartPointGraphic from './StartPointGraphic.svelte';
    import EndPointGraphic from './EndPointGraphic.svelte';
    import TangentGraphic from './TangentGraphic.svelte';
    import DirectionArrowGraphic from './DirectionArrowGraphic.svelte';
    import NormalGraphic from './NormalGraphic.svelte';
    import LeadGraphic from './LeadGraphic.svelte';
    import CutGraphic from './CutGraphic.svelte';

    // Component props
    let {
        cuts = [],
        zoomScale,
    }: {
        cuts?: Cut[];
        zoomScale: number;
    } = $props();

    // Get unit scale for constant screen sizes
    const unitScale = $derived(drawingStore.unitScale);

    // Track when cuts prop changes
    $effect(() => {
        void cuts.length;
    });

    // Selection state from stores
    const selectedCutIds = $derived(selectionStore.cuts.selected);

    // Cut mouse event handlers
    function handleCutClick(e: MouseEvent) {
        // Check selection mode - only allow cut selection in Auto or Cut mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Cut
        ) {
            return;
        }

        // Get the cut ID from the clicked element or its parent
        // eslint-disable-next-line no-undef
        const target = e.target as SVGElement;
        const cutElement = target.closest('[data-cut-id]');
        const cutId = cutElement?.getAttribute('data-cut-id');

        if (cutId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            // Allow individual cut selection
            if (e.ctrlKey || e.metaKey) {
                // Multi-select mode: toggle cut selection
                if (selectedCutIds.has(cutId)) {
                    selectionStore.deselectCut(cutId);
                } else {
                    selectionStore.selectCut(cutId, true);
                }
            } else {
                // Single select mode: clear others and select this one
                if (!selectedCutIds.has(cutId)) {
                    selectionStore.clearCutSelection();
                }
                selectionStore.selectCut(cutId, false);
            }
        }
    }

    function handleCutMouseMove(e: MouseEvent) {
        // Check selection mode - only allow cut selection in Auto or Cut mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Cut
        ) {
            return;
        }

        // Get the cut ID from the hovered element or its parent
        // eslint-disable-next-line no-undef
        const target = e.target as SVGElement;
        const cutElement = target?.closest('[data-cut-id]');
        const cutId = cutElement?.getAttribute('data-cut-id');

        if (cutId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            selectionStore.highlightCut(cutId);
        }
    }

    // Lead mouse event handlers
    function handleLeadClick(e: MouseEvent) {
        // Check selection mode - only allow lead selection in Auto or Lead mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Lead
        ) {
            return;
        }

        // Get the lead ID from the clicked element or its parent
        // eslint-disable-next-line no-undef
        const target = e.target as SVGElement;
        const leadElement = target.closest('[data-lead-id]');
        const leadId = leadElement?.getAttribute('data-lead-id');

        if (leadId) {
            // Stop propagation to prevent triggering background or cut click handler
            e.stopPropagation();

            // Allow individual lead selection
            if (e.ctrlKey || e.metaKey) {
                // Multi-select mode: toggle lead selection
                selectionStore.toggleLeadSelection(leadId);
            } else {
                // Single select mode: clear others and select this one
                selectionStore.clearLeadSelection();
                selectionStore.selectLead(leadId, false);
            }
        }
    }

    function handleLeadMouseMove(e: MouseEvent) {
        // Check selection mode - only allow lead selection in Auto or Lead mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Lead
        ) {
            return;
        }

        // Get the lead ID from the hovered element or its parent
        // eslint-disable-next-line no-undef
        const target = e.target as SVGElement;
        const leadElement = target?.closest('[data-lead-id]');
        const leadId = leadElement?.getAttribute('data-lead-id');

        if (leadId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            selectionStore.highlightLead(leadId);
        }
    }
</script>

<g class="cuts">
    <!-- Cut paths -->
    <g id="cuts">
        {#each cuts as cut (cut.id)}
            <CutGraphic
                {cut}
                onclick={handleCutClick}
                onmousemove={handleCutMouseMove}
            />
        {/each}
    </g>

    <!-- Leads -->
    <g id="leads">
        {#each cuts as cut (cut.id)}
            <LeadGraphic
                {cut}
                {zoomScale}
                onclick={handleLeadClick}
                onmousemove={handleLeadMouseMove}
            />
        {/each}
    </g>

    <!-- Cut Start/End Points -->
    {#if visualizationStore.showCutStartPoints || visualizationStore.showCutEndPoints}
        <g id="cut-endpoints">
            {#each cuts as cut (cut.id)}
                {#if cut.chain}
                    {#if visualizationStore.showCutStartPoints}
                        {@const startPoint = cut.chain.startPoint}
                        <StartPointGraphic
                            point={startPoint}
                            {unitScale}
                            {zoomScale}
                        />
                    {/if}
                    {#if visualizationStore.showCutEndPoints}
                        {@const endPoint = cut.chain.endPoint}
                        <EndPointGraphic
                            point={endPoint}
                            {unitScale}
                            {zoomScale}
                        />
                    {/if}
                {/if}
            {/each}
        </g>
    {/if}

    <!-- Cut Normals -->
    {#if visualizationStore.showCutNormals}
        <g id="cut-normals">
            {#each cuts as cut (cut.id)}
                {@const startPoint = cut.normalConnectionPoint}
                {@const normal = cut.normal}
                <NormalGraphic {startPoint} {normal} {unitScale} {zoomScale} />
            {/each}
        </g>
    {/if}

    <!-- Cut Direction Indicators -->
    {#if visualizationStore.showCutDirections}
        <g id="cut-directions">
            {#each cuts as cut (cut.id)}
                {#if cut.chain}
                    {@const midpoint = cut.chain.midPoint}
                    {@const p1 = cut.chain.pointAt(0.49)}
                    {@const p2 = cut.chain.pointAt(0.51)}
                    <DirectionArrowGraphic
                        {midpoint}
                        {p1}
                        {p2}
                        {unitScale}
                        {zoomScale}
                    />
                {/if}
            {/each}
        </g>
    {/if}

    <!-- Cut Tangent Lines -->
    {#if visualizationStore.showCutTangentLines}
        <g id="cut-tangents">
            {#each cuts as cut (cut.id)}
                {#if cut.chain}
                    <!-- Start point tangent -->
                    {@const startPoint = cut.chain.startPoint}
                    {@const startTangent = cut.chain.tangent}
                    <TangentGraphic
                        point={startPoint}
                        tangent={startTangent}
                        {unitScale}
                        {zoomScale}
                    />

                    <!-- End point tangent -->
                    {@const endPoint = cut.chain.endPoint}
                    {@const endTangent = cut.chain.tangent}
                    <TangentGraphic
                        point={endPoint}
                        tangent={endTangent}
                        {unitScale}
                        {zoomScale}
                    />
                {/if}
            {/each}
        </g>
    {/if}
</g>
