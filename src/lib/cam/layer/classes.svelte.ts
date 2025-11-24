import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { normalizeChain } from '$lib/cam/chain/chain-normalization';
import { DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM } from '$lib/preprocessing/algorithm-parameters';
import { Chain } from '$lib/cam/chain/classes';
import type { LayerData } from './interfaces';
import { detectParts } from '$lib/cam/part/part-detection';
import { Part } from '$lib/cam/part/classes.svelte';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/cam/chain/constants';

export class Layer implements LayerData {
    #data: LayerData;
    #chains: Chain[] = $state([]);
    #parts: Part[] = $state([]);
    #partsGenerated: boolean = false;

    constructor(data: LayerData) {
        this.#data = data;
        const layerName = data.name ?? '0';

        // Detect chains and normalize them to set clockwise property
        const detectedChains = detectShapeChains(this.shapes, {
            tolerance: 0.05,
        });

        this.#chains.push(
            ...detectedChains.map((chain) => {
                // Prefix chain ID with layer name to ensure global uniqueness
                const prefixedChain = {
                    ...chain,
                    id: `${layerName}-${chain.id}`,
                };
                const normalizedChain = normalizeChain(
                    prefixedChain,
                    DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM
                );
                return new Chain(normalizedChain);
            })
        );

        // Generate parts immediately in constructor
        this.#generateParts();
    }

    async #generateParts() {
        if (this.#partsGenerated) return;

        const layerName = this.#data.name ?? '0';
        const result = await detectParts(
            this.#chains,
            CHAIN_CLOSURE_TOLERANCE,
            DEFAULT_PART_DETECTION_PARAMETERS,
            layerName
        );
        this.#parts = result.parts;
        this.#partsGenerated = true;
    }

    get shapes() {
        return this.#data.shapes;
    }

    get chains() {
        return this.#chains;
    }

    get parts() {
        return this.#parts;
    }

    get name() {
        return this.#data.name ?? '(none)';
    }

    toData(): LayerData {
        return {
            shapes: this.shapes,
            name: this.name,
        };
    }
}
