<script lang="ts">
    import { Grid, Willow } from '@svar-ui/svelte-grid';
    import type { Snippet } from 'svelte';

    interface Props {
        properties: Array<{ property: string; value: string | number }>;
        onCopy?: () => void;
        children?: Snippet;
    }

    let { properties, onCopy, children }: Props = $props();

    // Transform properties into SVAR Grid data format
    const gridData = $derived(
        properties.map((prop, index) => ({
            id: `prop-${index}`,
            property: prop.property,
            value: String(prop.value),
        }))
    );

    // Define columns for properties table
    const columns = [
        {
            id: 'property',
            header: 'Property',
            width: 140,
        },
        {
            id: 'value',
            header: 'Value',
            flexgrow: 1,
        },
    ];
</script>

<div class="inspect-properties">
    <Willow>
        <Grid data={gridData} {columns} select={false} />
    </Willow>

    {#if onCopy}
        <div class="button-row">
            <button
                class="copy-button"
                onclick={onCopy}
                title="Copy to clipboard"
            >
                Copy
            </button>
        </div>
    {/if}

    <!-- Render additional content below the properties table -->
    {#if children}
        {@render children()}
    {/if}
</div>

<style>
    .inspect-properties {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 200px;
    }

    .button-row {
        display: flex;
        justify-content: flex-end;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .copy-button {
        padding: 0.25rem 0.75rem;
        background-color: #fff;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .copy-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
    }

    .copy-button:active {
        background-color: #f3f4f6;
    }
</style>
