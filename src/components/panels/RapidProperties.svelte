<script lang="ts">
    import { rapidStore } from '$lib/stores/rapids/store';
    import { planStore } from '$lib/stores/plan/store';

    // Reactive rapid data
    const rapidState = $derived($rapidStore);
    const cuts = $derived($planStore.plan.cuts);
    const rapids = $derived(
        cuts.map((cut) => cut.rapidIn).filter((rapid) => rapid !== undefined)
    );
    const selectedRapidIds = $derived(rapidState.selectedRapidIds);
    const selectedRapidId = $derived(
        selectedRapidIds.size === 1 ? Array.from(selectedRapidIds)[0] : null
    );
    const highlightedRapidId = $derived(rapidState.highlightedRapidId);
    const activeRapidId = $derived(selectedRapidId || highlightedRapidId);
    const selectedRapid = $derived(
        activeRapidId
            ? rapids.find((rapid) => rapid.id === activeRapidId)
            : null
    );

    // Calculate rapid distance
    function calculateDistance(
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    async function copyRapidToClipboard() {
        if (!selectedRapid) return;

        try {
            const json = JSON.stringify(selectedRapid, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="rapid-properties">
    {#if selectedRapid}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">ID:</span>
                <span class="property-value">{selectedRapid.id}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Type:</span>
                <span class="property-value rapid-type">Rapid</span>
            </div>

            <div class="property-section-title">Start Point</div>

            <div class="property-row">
                <span class="property-label">X:</span>
                <span class="property-value"
                    >{selectedRapid.start.x.toFixed(3)}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Y:</span>
                <span class="property-value"
                    >{selectedRapid.start.y.toFixed(3)}</span
                >
            </div>

            <div class="property-section-title">End Point</div>

            <div class="property-row">
                <span class="property-label">X:</span>
                <span class="property-value"
                    >{selectedRapid.end.x.toFixed(3)}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Y:</span>
                <span class="property-value"
                    >{selectedRapid.end.y.toFixed(3)}</span
                >
            </div>

            <div class="property-section-title">Movement</div>

            <div class="property-row">
                <span class="property-label">Distance:</span>
                <span class="property-value"
                    >{calculateDistance(
                        selectedRapid.start,
                        selectedRapid.end
                    ).toFixed(3)} units</span
                >
            </div>

            <button class="copy-button" onclick={copyRapidToClipboard}>
                Copy to Clipboard
            </button>
        </div>
    {:else}
        <p class="no-selection">No rapid selected</p>
    {/if}
</div>

<style>
    .rapid-properties {
        padding: 0.5rem;
    }

    .property-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .property-section-title {
        font-weight: 600;
        font-size: 0.9rem;
        color: #333;
        margin-top: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid #e0e0e0;
    }

    .property-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        font-size: 0.875rem;
    }

    .property-label {
        font-weight: 500;
        color: #666;
        flex-shrink: 0;
    }

    .property-value {
        text-align: right;
        word-break: break-word;
        color: #333;
        font-family: 'Courier New', monospace;
    }

    .property-value.rapid-type {
        font-weight: 600;
        color: rgb(0, 83, 135);
    }

    .copy-button {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s ease;
    }

    .copy-button:hover {
        background-color: #e0e0e0;
        border-color: #999;
    }

    .copy-button:active {
        background-color: #d0d0d0;
    }

    .no-selection {
        color: #666;
        font-style: italic;
        margin: 0;
        text-align: center;
        padding: 1rem;
    }
</style>
