<script lang="ts">
    import type { Shape } from '$lib/cam/shape/classes';
    import type { Point2D } from '$lib/geometry/point/interfaces';
    import { isShapeClosed } from '$lib/cam/shape/functions';
    import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';

    let {
        shape,
        stroke,
        onclick,
        onmousemove,
    }: {
        shape: Shape;
        stroke: string;
        onclick?: (e: MouseEvent) => void;
        onmousemove?: (e: MouseEvent) => void;
    } = $props();

    // Convert points to SVG path data without coordinate transformation
    function pointsToRawPathData(points: Point2D[], closed: boolean): string {
        if (!points || points.length === 0) {
            return '';
        }

        let pathData = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathData += ` L ${points[i].x} ${points[i].y}`;
        }
        if (closed) {
            pathData += ' Z';
        }
        return pathData;
    }

    const pathData = $derived.by(() => {
        const tessellated = shape.tessellated;
        const closed = isShapeClosed(
            shape,
            DEFAULT_PART_DETECTION_PARAMETERS.tessellationTolerance
        );
        return pointsToRawPathData(tessellated, closed);
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<g>
    <!-- Invisible hit area (8px wide) -->
    <path
        data-shape-id={shape.id}
        d={pathData}
        {stroke}
        stroke-width="8"
        fill="none"
        vector-effect="non-scaling-stroke"
        style="opacity: 0; pointer-events: stroke;"
        {onclick}
        {onmousemove}
    />
    <!-- Visible path (1px wide) -->
    <path
        data-shape-id={shape.id}
        d={pathData}
        {stroke}
        stroke-width="1"
        fill="none"
        vector-effect="non-scaling-stroke"
        style="pointer-events: none;"
    />
</g>
