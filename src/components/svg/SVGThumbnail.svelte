<script lang="ts">
    import type { Drawing } from '$lib/cam/drawing/classes.svelte';
    import ShapeGraphic from './ShapeGraphic.svelte';
    import { calculateThumbnailViewBox } from '$lib/utils/thumbnail-viewbox';

    interface Props {
        drawing: Drawing;
    }

    let { drawing }: Props = $props();

    // Get all shapes from the drawing
    const shapes = $derived(drawing.shapes);

    // Get bounding box
    const bounds = $derived(drawing.bounds);

    // Calculate viewBox with padding and centered at origin
    const viewBox = $derived(calculateThumbnailViewBox(bounds, 0.1));

    // Calculate stroke width based on drawing size
    const strokeWidth = $derived.by(() => {
        const width = bounds.max.x - bounds.min.x;
        const height = bounds.max.y - bounds.min.y;
        return Math.max(width, height) * 0.002;
    });
</script>

<svg {viewBox} xmlns="http://www.w3.org/2000/svg" class="thumbnail-svg">
    <!-- Flip Y-axis: DXF uses Y-up, SVG uses Y-down -->
    <g transform="scale(1, -1)">
        <g stroke-width={strokeWidth}>
            {#each shapes as shape (shape.id)}
                <ShapeGraphic {shape} stroke="#000000" />
            {/each}
        </g>
    </g>
</svg>

<style>
    .thumbnail-svg {
        width: 100%;
        height: 100%;
    }
</style>
