<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { partStore } from '$lib/stores/parts/store';

    // Props for event callbacks
    export let onPartClick: ((partId: string) => void) | null = null;
    export let onPartHover: ((partId: string) => void) | null = null;
    export let onPartHoverEnd: (() => void) | null = null;

    // Reactive state
    $: detectedParts = $partStore.parts;
    $: selectedPartId = $partStore.selectedPartId;
    $: hoveredPartId = $partStore.hoveredPartId;
</script>

<AccordionPanel title="Parts ({detectedParts.length})" isExpanded={false}>
    {#if detectedParts.length > 0}
        <div class="parts-list">
            {#each detectedParts as part, index (part.id)}
                <div
                    class="part-item {selectedPartId === part.id
                        ? 'selected'
                        : ''} {hoveredPartId === part.id
                        ? 'hovered'
                        : ''}"
                    role="button"
                    tabindex="0"
                    onclick={() => onPartClick && onPartClick(part.id)}
                    onkeydown={(e) =>
                        e.key === 'Enter' &&
                        onPartClick &&
                        onPartClick(part.id)}
                    onmouseenter={() => onPartHover && onPartHover(part.id)}
                    onmouseleave={() => onPartHoverEnd && onPartHoverEnd()}
                >
                    <div class="part-header">
                        <span class="part-name">Part {index + 1}</span>
                        <span class="part-info"
                            >{part.holes.length} holes</span
                        >
                    </div>
                    <div class="part-details">
                        <div class="shell-info">
                            <span class="shell-label">Shell:</span>
                            <span class="chain-ref"
                                >{part.shell.chain.shapes.length} shapes</span
                            >
                        </div>
                        {#if part.holes.length > 0}
                            <div class="holes-info">
                                <span class="holes-label">Holes:</span>
                                {#each part.holes as hole, holeIndex (hole.id)}
                                    <div class="hole-item">
                                        <span class="hole-ref"
                                            >Hole {holeIndex + 1}: {hole.chain
                                                .shapes.length} shapes</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="empty-state">
            <p>No parts detected.</p>
        </div>
    {/if}
</AccordionPanel>

<style>
    .parts-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .part-item {
        padding: 0.75rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
    }

    .part-item:hover {
        background-color: #f1f5f9;
        border-color: #cbd5e1;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .part-item.selected {
        background-color: #fef3c7;
        border-color: #f59e0b;
    }

    .part-item.hovered {
        background-color: #fef9e7;
        border-color: #fbbf24;
    }

    .part-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .part-name {
        font-weight: 600;
        color: rgb(0, 83, 135);
        font-size: 0.9rem;
    }

    .part-info {
        font-size: 0.8rem;
        color: #6b7280;
        background-color: #e5e7eb;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .part-details {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: #666;
    }

    .shell-info,
    .holes-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .shell-label,
    .holes-label {
        font-weight: 500;
        color: #555;
        font-size: 0.8rem;
    }

    .chain-ref {
        color: #666;
        margin-left: 0.5rem;
    }

    .hole-item {
        margin-left: 0.5rem;
    }

    .hole-ref {
        color: #666;
        font-size: 0.75rem;
    }

    .empty-state {
        padding: 1rem;
        text-align: center;
        color: #9ca3af;
        background-color: #f9fafb;
        border-radius: 0.375rem;
        border: 1px dashed #d1d5db;
    }

    .empty-state p {
        margin: 0;
        font-size: 0.875rem;
    }
</style>
