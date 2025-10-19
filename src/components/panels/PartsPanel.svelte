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
                        : ''} {hoveredPartId === part.id ? 'hovered' : ''}"
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
                            >{part.voids.length} voids, {part.slots.length} slots</span
                        >
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
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
    }

    .part-item:hover {
        background-color: #f9fafb;
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
