<script lang="ts">
    import { onMount } from 'svelte';
    import { parseDXF } from '$lib/parsers/dxf/functions';
    import { Drawing } from '$lib/cam/drawing/classes.svelte';
    import { OriginLocation } from '$lib/cam/drawing/enums';
    import SVGThumbnail from '$components/svg/SVGThumbnail.svelte';

    interface FileCard {
        name: string;
        path: string;
        type: 'dxf' | 'svg';
        thumbnail: string | Drawing; // SVG files use string, DXF files use Drawing
    }

    interface Props {
        onfileSelect?: (path: string) => void;
    }

    let { onfileSelect }: Props = $props();

    let files: FileCard[] = $state([]);
    let loading = $state(true);

    onMount(async () => {
        await loadFiles();
        loading = false;
    });

    async function loadFiles() {
        try {
            // Fetch DXF files
            const dxfFiles = await fetchDXFFiles();
            // Fetch SVG files
            const svgFiles = await fetchSVGFiles();

            files = [...dxfFiles, ...svgFiles];
        } catch (error) {
            console.error('Error loading files:', error);
        }
    }

    async function fetchDXFFiles(): Promise<FileCard[]> {
        const dxfPaths = [
            '1997.dxf',
            '5inchknife.dxf',
            'ADLER.dxf',
            'DOGLABPLAQUE.dxf',
            'Tractor Light Mount - Left.dxf',
            'Tractor Light Mount - Right.dxf',
            'Tractor Seat Mount - Left.dxf',
            'YOUCANMOVEMOUNTAINS.dxf',
        ];

        const cards: FileCard[] = [];

        for (const path of dxfPaths) {
            try {
                const response = await fetch(`/examples/${path}`);
                const dxfContent = await response.text();

                // Parse DXF and create Drawing instance for thumbnail
                const drawingData = await parseDXF(dxfContent);
                const drawing = new Drawing(drawingData);

                // Translate to positive quadrant for consistent thumbnail positioning
                drawing.originTo(OriginLocation.BOTTOM_LEFT);

                cards.push({
                    name: path.split('/').pop() || path,
                    path: `/examples/${path}`,
                    type: 'dxf',
                    thumbnail: drawing,
                });
            } catch (error) {
                console.warn(`Failed to load DXF: ${path}`, error);
            }
        }

        return cards;
    }

    async function fetchSVGFiles(): Promise<FileCard[]> {
        const svgPaths = [
            'Beaver-Outline.svg',
            'MrTim_Australia_Outline.svg',
            'Salt-Lake-Temple-Silhouette.svg',
            'themanwithoutsex-sitting-cat-outline.svg',
        ];

        const cards: FileCard[] = [];

        for (const path of svgPaths) {
            try {
                const response = await fetch(`/examples/${path}`);
                const svgContent = await response.text();

                cards.push({
                    name: path,
                    path: `/examples/${path}`,
                    type: 'svg',
                    thumbnail: svgContent,
                });
            } catch (error) {
                console.warn(`Failed to load SVG: ${path}`, error);
            }
        }

        return cards;
    }

    function handleCardClick(file: FileCard) {
        onfileSelect?.(file.path);
    }
</script>

<div class="file-gallery">
    {#if loading}
        <div class="loading">Loading files...</div>
    {:else}
        <div class="gallery-grid">
            {#each files as file (file.path)}
                <button
                    class="file-card"
                    onclick={() => handleCardClick(file)}
                    type="button"
                    aria-label="Load {file.name}"
                >
                    <div class="thumbnail">
                        {#if typeof file.thumbnail === 'string'}
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                            {@html file.thumbnail}
                        {:else}
                            <SVGThumbnail drawing={file.thumbnail} />
                        {/if}
                    </div>
                    <div class="file-name">{file.name}</div>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .file-gallery {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        padding: 1rem;
        background-color: #f9fafb;
    }

    .loading {
        text-align: center;
        padding: 2rem;
        color: #6b7280;
        font-size: 1rem;
    }

    .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
    }

    .file-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        text-align: center;
    }

    .file-card:hover {
        border-color: rgb(0, 83, 135);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .file-card:focus {
        outline: none;
        border-color: rgb(0, 83, 135);
        box-shadow: 0 0 0 2px rgba(0, 83, 135, 0.3);
    }

    .thumbnail {
        width: 100%;
        height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f9fafb;
        border-radius: 0.25rem;
        overflow: hidden;
    }

    .thumbnail :global(svg) {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    .file-name {
        font-size: 0.875rem;
        color: #374151;
        text-align: center;
        word-break: break-word;
        line-height: 1.25;
    }

    @media (max-width: 768px) {
        .gallery-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        }

        .thumbnail {
            height: 120px;
        }
    }
</style>
