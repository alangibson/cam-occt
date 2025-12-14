<script lang="ts">
    import type { Chain } from '$lib/cam/chain/classes.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { SelectionMode } from '$lib/config/settings/enums';
    import ChainGraphic from './ChainGraphic.svelte';
    import StartPointGraphic from './StartPointGraphic.svelte';
    import EndPointGraphic from './EndPointGraphic.svelte';
    import TessellationGraphic from './TessellationGraphic.svelte';
    import TangentGraphic from './TangentGraphic.svelte';
    import DirectionArrowGraphic from './DirectionArrowGraphic.svelte';
    import NormalGraphic from './NormalGraphic.svelte';

    // Component props
    let {
        chains = [],
        zoomScale,
    }: {
        chains?: Chain[];
        zoomScale: number;
    } = $props();

    // Get unit scale for constant screen sizes
    const unitScale = $derived(drawingStore.unitScale);

    // Track when chains prop changes
    $effect(() => {
        void chains.length;
    });

    // Selection state from stores
    const selectedChainIds = $derived(selectionStore.chains.selected);

    // Chain mouse event handlers
    function handleChainClick(e: MouseEvent) {
        // Check selection mode - only allow chain selection in Auto or Chain mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Chain
        ) {
            return;
        }

        // Get the chain ID from the clicked element or its parent
        const target = e.target as SVGElement;
        const chainElement = target.closest('[data-chain-id]');
        const chainId = chainElement?.getAttribute('data-chain-id');

        if (chainId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            // Allow individual chain selection
            if (e.ctrlKey || e.metaKey) {
                // Multi-select mode: toggle chain selection
                if (selectedChainIds.has(chainId)) {
                    selectionStore.deselectChain(chainId);
                } else {
                    selectionStore.selectChain(chainId, true);
                }
            } else {
                // Single select mode: clear others and select this one
                if (!selectedChainIds.has(chainId)) {
                    selectionStore.clearChainSelection();
                }
                selectionStore.selectChain(chainId, false);
            }
        }
    }

    function handleChainMouseMove(e: MouseEvent) {
        // Check selection mode - only allow chain selection in Auto or Chain mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Chain
        ) {
            return;
        }

        // Get the chain ID from the hovered element or its parent
        const target = e.target as SVGElement;
        const chainElement = target?.closest('[data-chain-id]');
        const chainId = chainElement?.getAttribute('data-chain-id');

        if (chainId) {
            // Stop propagation to prevent triggering background click handler
            e.stopPropagation();

            selectionStore.highlightChain(chainId);
        }
    }
</script>

<g class="chains">
    <!-- Chain paths -->
    {#if visualizationStore.showChainPaths}
        <g id="chains">
            {#each chains as chain (chain.id)}
                <ChainGraphic
                    {chain}
                    onclick={handleChainClick}
                    onmousemove={handleChainMouseMove}
                />
            {/each}
        </g>
    {/if}

    <!-- Chain Start/End Points -->
    {#if visualizationStore.showChainStartPoints || visualizationStore.showChainEndPoints}
        <g id="chain-endpoints">
            {#each chains as chain (chain.id)}
                {#if chain.shapes.length > 0}
                    {#if visualizationStore.showChainStartPoints}
                        {@const startPoint = chain.startPoint}
                        <StartPointGraphic
                            point={startPoint}
                            {unitScale}
                            {zoomScale}
                        />
                    {/if}
                    {#if visualizationStore.showChainEndPoints}
                        {@const endPoint = chain.endPoint}
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

    <!-- Chain Tangent Lines -->
    {#if visualizationStore.showChainTangentLines}
        <g id="chain-tangents">
            {#each chains as chain (chain.id)}
                {#if chain.shapes.length > 0}
                    <!-- Start point tangent -->
                    {@const startPoint = chain.startPoint}
                    {@const startTangent = chain.tangent}
                    <TangentGraphic
                        point={startPoint}
                        tangent={startTangent}
                        {unitScale}
                        {zoomScale}
                    />

                    <!-- End point tangent -->
                    {@const endPoint = chain.endPoint}
                    {@const endTangent = chain.tangent}
                    {#if endTangent}
                        <TangentGraphic
                            point={endPoint}
                            tangent={endTangent}
                            {unitScale}
                            {zoomScale}
                        />
                    {/if}
                {/if}
            {/each}
        </g>
    {/if}

    <!-- Chain Normals -->
    {#if visualizationStore.showChainNormals}
        <g id="chain-normals">
            {#each chains as chain (chain.id)}
                {#if chain.shapes.length > 0}
                    {@const startPoint = chain.startPoint}
                    {@const normal = chain.normal}
                    <NormalGraphic
                        {startPoint}
                        {normal}
                        {unitScale}
                        {zoomScale}
                    />
                {/if}
            {/each}
        </g>
    {/if}

    <!-- Chain Direction Indicators (Winding Direction) -->
    {#if visualizationStore.showChainDirections}
        <g id="chain-directions">
            {#each chains as chain (chain.id)}
                {#if chain.shapes.length > 0}
                    {@const midpoint = chain.midPoint}
                    {@const p1 = chain.pointAt(0.49)}
                    {@const p2 = chain.pointAt(0.51)}
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

    <!-- Chain Tessellation -->
    {#if visualizationStore.showChainTessellation}
        <g id="chain-tessellation">
            {#each chains as chain (chain.id)}
                {@const tessellationPoints = chain.tessellated}
                <TessellationGraphic
                    points={tessellationPoints}
                    {unitScale}
                    {zoomScale}
                />
            {/each}
        </g>
    {/if}
</g>
