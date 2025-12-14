<script lang="ts">
    import type { Part } from '$lib/cam/part/classes.svelte';
    import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { SelectionMode } from '$lib/config/settings/enums';
    import ShapeGraphic from './ShapeGraphic.svelte';
    import StartPointGraphic from './StartPointGraphic.svelte';
    import EndPointGraphic from './EndPointGraphic.svelte';
    import TessellationGraphic from './TessellationGraphic.svelte';
    import TangentGraphic from './TangentGraphic.svelte';
    import DirectionArrowGraphic from './DirectionArrowGraphic.svelte';
    import NormalGraphic from './NormalGraphic.svelte';
    import { Chain } from '$lib/cam/chain/classes.svelte';

    // Component props
    let {
        parts = [],
        zoomScale,
    }: {
        parts?: Part[];
        zoomScale: number;
    } = $props();

    // Get unit scale for constant screen sizes
    const unitScale = $derived(drawingStore.unitScale);

    // Track when parts prop changes
    $effect(() => {
        void parts.length;
    });

    // Selection state from stores
    const selectedPartIds = $derived(selectionStore.parts.selected);
    const highlightedPartId = $derived(selectionStore.parts.highlighted);
    const selectedChainIds = $derived(selectionStore.chains.selected);
    const highlightedChainId = $derived(selectionStore.chains.highlighted);

    // Get all chains from parts (shells, voids, slots)
    const allPartChains = $derived.by(() => {
        const chains: Array<{
            chain: Chain;
            type: 'shell' | 'void' | 'slot';
            partId: string;
        }> = [];
        for (const part of parts) {
            // Add shell chain
            chains.push({
                chain: new Chain(part.shell),
                type: 'shell',
                partId: part.id,
            });
            // Add void chains
            if (part.voids && Array.isArray(part.voids)) {
                for (const voidItem of part.voids) {
                    chains.push({
                        chain: new Chain(voidItem.chain),
                        type: 'void',
                        partId: part.id,
                    });
                }
            }
            // Add slot chains
            if (part.slots && Array.isArray(part.slots)) {
                for (const slot of part.slots) {
                    chains.push({
                        chain: new Chain(slot.chain),
                        type: 'slot',
                        partId: part.id,
                    });
                }
            }
        }
        return chains;
    });

    // Get stroke color for a part chain based on type and selection state
    function getPartChainStrokeColor(
        chainId: string,
        partId: string,
        chainType: 'shell' | 'void' | 'slot'
    ): string {
        // Check chain selection/highlight first (takes precedence)
        if (selectedChainIds.has(chainId) || highlightedChainId === chainId) {
            return '#ff6600'; // Orange for selected/highlighted chain
        }
        // Then check part selection/highlight
        if (selectedPartIds.has(partId) || highlightedPartId === partId) {
            return '#ff6600'; // Orange for selected/highlighted part
        }
        // Use lighter blue for voids and slots, darker blue for shells
        if (chainType === 'shell') {
            return 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for shells
        } else {
            return 'rgb(153, 204, 255)'; // Lighter blue for voids and slots
        }
    }

    // Get fill color for a part surface based on selection state
    function getPartFillColor(partId: string): string {
        if (selectedPartIds.has(partId) || highlightedPartId === partId) {
            return 'rgba(255, 102, 0, 0.1)'; // Very light orange (10% opacity) for selected/highlighted
        }
        return 'transparent'; // Transparent for normal state
    }

    // Helper function to convert a chain to SVG path data
    function chainToPathData(chain: Chain): string {
        const shapes = chain.shapes;
        if (shapes.length === 0) {
            return '';
        }

        let pathData = '';
        for (const shape of shapes) {
            const tessellated = shape.tessellated;
            if (tessellated.length === 0) continue;

            if (pathData === '') {
                // First shape - use M (moveto)
                pathData = `M ${tessellated[0].x} ${tessellated[0].y}`;
                for (let i = 1; i < tessellated.length; i++) {
                    pathData += ` L ${tessellated[i].x} ${tessellated[i].y}`;
                }
            } else {
                // Subsequent shapes - append with L (lineto)
                for (let i = 0; i < tessellated.length; i++) {
                    pathData += ` L ${tessellated[i].x} ${tessellated[i].y}`;
                }
            }
        }

        // Close the path if the chain is closed
        if (chain.isClosed) {
            pathData += ' Z';
        }

        return pathData;
    }

    // Create combined path data for a part (shell + voids)
    // Using SVG even-odd fill rule to create holes
    function partToFillPathData(part: Part): string {
        const shell = new Chain(part.shell);
        let pathData = chainToPathData(shell);

        // Add void paths
        if (part.voids && Array.isArray(part.voids)) {
            for (const voidItem of part.voids) {
                const voidChain = new Chain(voidItem.chain);
                const voidPath = chainToPathData(voidChain);
                if (voidPath) {
                    pathData += ' ' + voidPath;
                }
            }
        }

        return pathData;
    }

    // Part mouse event handlers (for clicking on part fill area)
    function handlePartClick(e: MouseEvent, partId: string) {
        // Check selection mode - only allow part selection in Auto or Part mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Part
        ) {
            return;
        }

        // Stop propagation to prevent triggering background click handler
        e.stopPropagation();

        // Allow individual part selection
        if (e.ctrlKey || e.metaKey) {
            // Multi-select mode: toggle part selection
            if (selectedPartIds.has(partId)) {
                selectionStore.deselectPart(partId);
            } else {
                selectionStore.selectPart(partId, true);
            }
        } else {
            // Single select mode: clear others and select this one
            if (!selectedPartIds.has(partId)) {
                selectionStore.clearPartSelection();
            }
            selectionStore.selectPart(partId, false);
        }
    }

    function handlePartMouseMove(e: MouseEvent, partId: string) {
        // Check selection mode - only allow part selection in Auto or Part mode
        const selectionMode = settingsStore.settings.selectionMode;
        if (
            selectionMode !== SelectionMode.Auto &&
            selectionMode !== SelectionMode.Part
        ) {
            return;
        }

        // Stop propagation to prevent triggering background click handler
        e.stopPropagation();

        selectionStore.highlightPart(partId);
    }

    // Chain mouse event handlers (for clicking on chains that form parts)
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
        // eslint-disable-next-line no-undef
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
        // eslint-disable-next-line no-undef
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

<g class="parts">
    <!-- Part fill areas for hover detection and selection highlighting -->
    {#if visualizationStore.showPartPaths}
        <g id="part-fill-areas">
            {#each parts as part (part.id)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <path
                    data-part-id={part.id}
                    d={partToFillPathData(part)}
                    fill={getPartFillColor(part.id)}
                    fill-rule="evenodd"
                    stroke="none"
                    style="pointer-events: fill;"
                    onmousemove={(e) => handlePartMouseMove(e, part.id)}
                    onclick={(e) => handlePartClick(e, part.id)}
                />
            {/each}
        </g>
    {/if}

    <!-- Part paths -->
    {#if visualizationStore.showPartPaths}
        <g id="parts">
            {#each allPartChains as { chain, type, partId } (chain.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <g
                    class="part-chain"
                    data-part-id={partId}
                    data-chain-id={chain.id}
                    data-chain-type={type}
                    role="button"
                    tabindex="0"
                    onclick={handleChainClick}
                    onmousemove={handleChainMouseMove}
                >
                    {#each chain.shapes as shape (shape.id)}
                        <ShapeGraphic
                            {shape}
                            stroke={getPartChainStrokeColor(
                                chain.id,
                                partId,
                                type
                            )}
                            onclick={handleChainClick}
                            onmousemove={handleChainMouseMove}
                        />
                    {/each}
                </g>
            {/each}
        </g>
    {/if}

    <!-- Part Start/End Points -->
    {#if visualizationStore.showPartStartPoints || visualizationStore.showPartEndPoints}
        <g id="part-endpoints">
            {#each allPartChains as { chain } (chain.id)}
                {#if chain.shapes.length > 0}
                    {#if visualizationStore.showPartStartPoints}
                        {@const startPoint = chain.startPoint}
                        <StartPointGraphic
                            point={startPoint}
                            {unitScale}
                            {zoomScale}
                        />
                    {/if}
                    {#if visualizationStore.showPartEndPoints}
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

    <!-- Part Tangent Lines -->
    {#if visualizationStore.showPartTangentLines}
        <g id="part-tangents">
            {#each allPartChains as { chain } (chain.id)}
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

    <!-- Part Normals -->
    {#if visualizationStore.showPartNormals}
        <g id="part-normals">
            {#each allPartChains as { chain } (chain.id)}
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

    <!-- Part Direction Indicators (Winding Direction) -->
    {#if visualizationStore.showPartDirections}
        <g id="part-directions">
            {#each allPartChains as { chain } (chain.id)}
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

    <!-- Part Tessellation -->
    {#if visualizationStore.showPartTessellation}
        <g id="part-tessellation">
            {#each allPartChains as { chain } (chain.id)}
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

<style>
    .part-chain:focus {
        outline: none;
    }
</style>
