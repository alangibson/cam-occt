import type { OperationData } from './interface';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import type { Part } from '$lib/cam/part/classes.svelte';
import { DEFAULT_SPOT_DURATION } from '$lib/config/defaults/operation-defaults';

export class Operation {
    private data: OperationData;
    #tool: Tool | null = null;
    #targets: (ChainData | Part)[] = [];

    constructor(data: OperationData) {
        this.data = data;
    }

    get id() {
        return this.data.id;
    }

    get name() {
        return this.data.name;
    }

    get action() {
        return this.data.action;
    }

    get toolId() {
        return this.data.toolId;
    }

    get targetType() {
        return this.data.targetType;
    }

    get targetIds() {
        return this.data.targetIds;
    }

    get enabled() {
        return this.data.enabled;
    }

    get order() {
        return this.data.order;
    }

    get cutDirection() {
        return this.data.cutDirection;
    }

    get leadInConfig() {
        return this.data.leadInConfig;
    }

    get leadOutConfig() {
        return this.data.leadOutConfig;
    }

    get kerfCompensation() {
        return this.data.kerfCompensation;
    }

    get holeUnderspeedEnabled() {
        return this.data.holeUnderspeedEnabled ?? false;
    }

    get holeUnderspeedPercent() {
        return this.data.holeUnderspeedPercent ?? 100;
    }

    get optimizeStarts() {
        return this.data.optimizeStarts;
    }

    get spotDuration() {
        return this.data.spotDuration ?? DEFAULT_SPOT_DURATION;
    }

    get tool(): Tool | null {
        return this.#tool;
    }

    get targets(): (ChainData | Part)[] {
        return this.#targets;
    }

    setTool(tool: Tool | null): void {
        this.#tool = tool;
    }

    setTargets(targets: (ChainData | Part)[]): void {
        this.#targets = targets;
    }

    toData(): OperationData {
        return { ...this.data };
    }
}
