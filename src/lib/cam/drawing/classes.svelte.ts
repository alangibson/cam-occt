import type { DrawingData } from './interfaces';
import type { LayerData } from '$lib/cam/layer/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import { Layer } from '$lib/cam/layer/classes.svelte';
import { Unit } from '$lib/config/units/units';

export class Drawing implements DrawingData {
    private data: DrawingData;
    #layers?: Record<string, Layer>;
    fileName = $state<string>('');

    constructor(data: DrawingData) {
        this.data = data;
        this.fileName = data.fileName ?? '';
    }

    get shapes() {
        return this.data?.shapes ?? [];
    }

    set shapes(value: Shape[]) {
        this.data.shapes = value;
        // Clear cached layers when shapes change
        this.#layers = undefined;
    }

    get bounds() {
        return this.data?.bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    set bounds(value: BoundingBox) {
        this.data.bounds = value;
    }

    get units() {
        return this.data?.units ?? Unit.MM;
    }

    set units(value: Unit) {
        this.data.units = value;
    }

    get layers(): Record<string, Layer> {
        // Return cached layers if available
        if (this.#layers) {
            return this.#layers;
        }

        const layersMap: Record<string, Layer> = {};

        // Guard against undefined or missing shapes
        if (!this.data || !this.data.shapes) {
            this.#layers = layersMap;
            return layersMap;
        }

        // Group shapes by layer (as LayerData)
        const layerDataMap: Record<string, LayerData> = {};

        this.data.shapes.forEach((shape) => {
            // Use default layer "0" if shape has no layer or empty layer
            const layerName =
                shape.layer && shape.layer.trim() !== '' ? shape.layer : '0';

            // Create layer data if it doesn't exist
            if (!layerDataMap[layerName]) {
                layerDataMap[layerName] = {
                    name: layerName,
                    shapes: [],
                };
            }

            // Add shape to the layer
            layerDataMap[layerName].shapes.push(shape);
        });

        // Convert LayerData to Layer instances
        Object.entries(layerDataMap).forEach(([name, data]) => {
            layersMap[name] = new Layer(data);
        });

        // Cache the result
        this.#layers = layersMap;
        return layersMap;
    }

    /**
     * Convert Drawing instance to plain DrawingData object for serialization
     */
    toData(): DrawingData {
        return {
            shapes: this.data.shapes,
            bounds: this.data.bounds,
            units: this.data.units,
            rawInsUnits: this.data.rawInsUnits,
            fileName: this.fileName,
        };
    }
}
