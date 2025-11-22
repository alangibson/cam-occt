import type { DrawingData } from './interfaces';
import type { LayerData } from '$lib/cam/layer/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import { getBoundingBoxForShapes } from '$lib/geometry/bounding-box/functions';
import { Layer } from '$lib/cam/layer/classes.svelte';
import { Unit } from '$lib/config/units/units';
import { EMPTY_BOUNDS } from '$lib/geometry/bounding-box/constants';

export class Drawing implements DrawingData {
    #data: DrawingData;
    #layers?: Record<string, Layer>;

    constructor(data: DrawingData) {
        this.#data = data;
    }

    get fileName(): string {
        return this.#data.fileName;
    }

    set fileName(value: string) {
        this.#data.fileName = value;
    }

    get shapes() {
        return this.#data?.shapes ?? [];
    }

    set shapes(value: ShapeData[]) {
        this.#data.shapes = value;
        // Clear cached layers when shapes change
        this.#layers = undefined;
    }

    get bounds(): BoundingBox {
        const shapes = this.#data?.shapes ?? [];
        if (shapes.length === 0) {
            return EMPTY_BOUNDS;
        }
        return getBoundingBoxForShapes(shapes);
    }

    get units() {
        return this.#data?.units ?? Unit.MM;
    }

    set units(value: Unit) {
        this.#data.units = value;
    }

    get layers(): Record<string, Layer> {
        // Return cached layers if available
        if (this.#layers) {
            return this.#layers;
        }

        const layersMap: Record<string, Layer> = {};

        // Guard against undefined or missing shapes
        if (!this.#data || !this.#data.shapes) {
            this.#layers = layersMap;
            return layersMap;
        }

        // Group shapes by layer (as LayerData)
        const layerDataMap: Record<string, LayerData> = {};

        this.#data.shapes.forEach((shape) => {
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
            shapes: this.#data.shapes,
            units: this.#data.units,
            fileName: this.fileName,
        };
    }
}
