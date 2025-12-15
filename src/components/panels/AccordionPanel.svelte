<script lang="ts">
    export let title: string;
    export let isExpanded: boolean = true;

    function toggleExpanded() {
        isExpanded = !isExpanded;
    }
</script>

<div class="accordion-panel">
    <div class="panel-header {isExpanded ? 'expanded' : ''}">
        <div
            class="header-left"
            onclick={toggleExpanded}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && toggleExpanded()}
        >
            <h3 class="panel-title">{title}</h3>
        </div>
        <div class="header-right">
            <slot name="header-button" />
            <svg
                class="arrow-icon {isExpanded ? 'expanded' : ''}"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                onclick={toggleExpanded}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && toggleExpanded()}
            >
                <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    stroke-width="2"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </div>
    </div>

    {#if isExpanded}
        <div class="panel-content">
            <slot />
        </div>
    {/if}
</div>

<style>
    .accordion-panel {
        background: white;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        overflow: hidden;
        flex-shrink: 0; /* Prevent entire panel from being compressed too much */
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.25rem 0.5rem;
        transition: background-color 0.2s ease;
        flex-shrink: 0; /* Prevent header from being compressed */
        min-height: 2rem; /* Ensure minimum visible height */
    }

    .header-left {
        cursor: pointer;
        flex: 1;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .panel-header:hover {
        background-color: #f9fafb;
    }

    .panel-header.expanded {
        border-bottom: 1px solid #f3f4f6;
    }

    .panel-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #374151;
    }

    .arrow-icon {
        color: #6b7280;
        transition: transform 0.2s ease;
        cursor: pointer;
    }

    .arrow-icon.expanded {
        transform: rotate(180deg);
    }

    .panel-content {
        padding: 0.5rem;
    }
</style>
