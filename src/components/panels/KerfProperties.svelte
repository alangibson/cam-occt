<script lang="ts">
    import { kerfStore } from '$lib/stores/kerfs/store';
    import { cutStore } from '$lib/stores/cuts/store';

    // Reactive kerf data
    $: kerfs = $kerfStore.kerfs;
    $: selectedKerfId = $kerfStore.selectedKerfId;
    $: selectedKerf = selectedKerfId
        ? kerfs.find((kerf) => kerf.id === selectedKerfId)
        : null;

    // Get the associated cut for reference
    $: cuts = $cutStore.cuts;
    $: associatedCut =
        selectedKerf && cuts && cuts.length > 0
            ? cuts.find((cut) => cut.id === selectedKerf.cutId)
            : null;

    async function copyKerfToClipboard() {
        if (!selectedKerf) return;

        try {
            const json = JSON.stringify(selectedKerf, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="kerf-properties">
    {#if selectedKerf}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">Name:</span>
                <span class="property-value">{selectedKerf.name}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Enabled:</span>
                <span
                    class="property-value {selectedKerf.enabled
                        ? 'enabled'
                        : 'disabled'}"
                >
                    {selectedKerf.enabled ? 'Yes' : 'No'}
                </span>
            </div>

            <div class="property-row">
                <span class="property-label">Kerf Width:</span>
                <span class="property-value"
                    >{selectedKerf.kerfWidth.toFixed(3)} units</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Type:</span>
                <span class="property-value"
                    >{selectedKerf.isClosed ? 'Closed' : 'Open'}</span
                >
            </div>

            {#if associatedCut}
                <div class="property-row">
                    <span class="property-label">Cut:</span>
                    <span class="property-value">{associatedCut.name}</span>
                </div>
            {/if}

            <div class="property-row">
                <span class="property-label">Cut ID:</span>
                <span class="property-value monospace"
                    >{selectedKerf.cutId}</span
                >
            </div>
        </div>

        <div class="property-group">
            <h4>Chains</h4>
            <div class="property-row">
                <span class="property-label">Inner Chain:</span>
                <span class="property-value"
                    >{selectedKerf.innerChain.shapes.length} shapes</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Outer Chain:</span>
                <span class="property-value"
                    >{selectedKerf.outerChain.shapes.length} shapes</span
                >
            </div>
        </div>

        <div class="property-group">
            <h4>Lead Geometry</h4>
            <div class="property-row">
                <span class="property-label">Lead-In:</span>
                <span class="property-value"
                    >{selectedKerf.leadIn ? 'Present' : 'None'}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Lead-Out:</span>
                <span class="property-value"
                    >{selectedKerf.leadOut ? 'Present' : 'None'}</span
                >
            </div>
        </div>

        <div class="property-group">
            <h4>Metadata</h4>
            <div class="property-row">
                <span class="property-label">ID:</span>
                <span class="property-value monospace">{selectedKerf.id}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Generated:</span>
                <span class="property-value"
                    >{new Date(selectedKerf.generatedAt).toLocaleString()}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Version:</span>
                <span class="property-value">{selectedKerf.version}</span>
            </div>
        </div>

        <div class="copy-section">
            <button class="copy-button" on:click={copyKerfToClipboard}>
                Copy JSON
            </button>
        </div>
    {:else}
        <p class="no-selection">No kerf selected</p>
    {/if}
</div>

<style>
    .kerf-properties {
        padding: 1rem;
        color: #333;
    }

    .property-group {
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #e0e0e0;
    }

    .property-group:last-of-type {
        border-bottom: none;
    }

    .property-group h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.9rem;
        font-weight: 600;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .property-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.25rem 0;
        font-size: 0.9rem;
    }

    .property-label {
        font-weight: 500;
        color: #666;
        flex: 0 0 40%;
    }

    .property-value {
        color: #333;
        text-align: right;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .property-value.monospace {
        font-family: 'Courier New', monospace;
        font-size: 0.85rem;
        word-break: break-all;
    }

    .property-value.enabled {
        color: #4caf50;
        font-weight: 600;
    }

    .property-value.disabled {
        color: #f44336;
        font-weight: 600;
    }

    .copy-section {
        margin-top: 1rem;
        text-align: center;
    }

    .copy-button {
        padding: 0.5rem 1rem;
        background-color: #2196f3;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .copy-button:hover {
        background-color: #1976d2;
    }

    .copy-button:active {
        background-color: #0d47a1;
    }

    .no-selection {
        color: #999;
        text-align: center;
        font-style: italic;
        padding: 2rem 1rem;
    }
</style>
