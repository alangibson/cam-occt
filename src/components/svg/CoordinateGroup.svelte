<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { Unit } from '$lib/config/units/units';

    type Props = {
        zoomScale: number;
    };

    let { zoomScale }: Props = $props();

    // Determine line length based on drawing units: 10mm or 1 inch
    const lineLengthInDrawingUnits = $derived(
        drawingStore.drawing?.units === Unit.INCH ? 1 : 10
    );

    // Track when coordinate cross renders
    $effect(() => {
        void lineLengthInDrawingUnits;
        void zoomScale;
    });
</script>

<!-- Origin cross at drawing's 0,0 -->
<g class="coordinate-cross">
    <!-- Horizontal line -->
    <line
        x1={-lineLengthInDrawingUnits}
        y1={0}
        x2={lineLengthInDrawingUnits}
        y2={0}
        stroke="#888888"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
    />
    <!-- Vertical line -->
    <line
        x1={0}
        y1={-lineLengthInDrawingUnits}
        x2={0}
        y2={lineLengthInDrawingUnits}
        stroke="#888888"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
    />
</g>
