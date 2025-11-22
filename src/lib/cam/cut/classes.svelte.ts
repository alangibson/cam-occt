import type { CutData } from './interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { CutDirection } from './enums';
import type { CacheableLead, LeadConfig } from '$lib/cam/lead/interfaces';
import type { NormalSide } from './enums';
import type { OffsetDirection } from '$lib/cam/offset/types';
import type { Rapid } from '$lib/cam/rapid/interfaces';
import type { Chain } from '$lib/geometry/chain/classes';
import { Offset } from '$lib/cam/offset/classes';

export class Cut {
    #data: CutData;

    constructor(data: CutData) {
        // Validate required fields
        if (!data.id) {
            console.error('Cut constructor called with invalid data:', data);
            throw new Error('Cut data must have an id field');
        }
        this.#data = data;
    }

    get id(): string {
        return this.#data.id;
    }

    get name(): string {
        return this.#data.name;
    }

    get enabled(): boolean {
        return this.#data.enabled;
    }

    get order(): number {
        return this.#data.order;
    }

    get operationId(): string {
        return this.#data.operationId;
    }

    get chainId(): string {
        return this.#data.chainId;
    }

    get toolId(): string | null {
        return this.#data.toolId;
    }

    get feedRate(): number | undefined {
        return this.#data.feedRate;
    }

    get pierceHeight(): number | undefined {
        return this.#data.pierceHeight;
    }

    get pierceDelay(): number | undefined {
        return this.#data.pierceDelay;
    }

    get arcVoltage(): number | undefined {
        return this.#data.arcVoltage;
    }

    get thcEnabled(): boolean | undefined {
        return this.#data.thcEnabled;
    }

    get overcutLength(): number | undefined {
        return this.#data.overcutLength;
    }

    get cutDirection(): CutDirection {
        return this.#data.cutDirection;
    }

    get cutChain(): Chain | undefined {
        return this.#data.cutChain;
    }

    set cutChain(cutChain: Chain | undefined) {
        this.#data.cutChain = cutChain;
    }

    get executionClockwise(): boolean | null | undefined {
        return this.#data.executionClockwise;
    }

    get normal(): Point2D {
        return this.#data.normal;
    }

    set normal(normal: Point2D) {
        this.#data.normal = normal;
    }

    get normalConnectionPoint(): Point2D {
        return this.#data.normalConnectionPoint;
    }

    set normalConnectionPoint(normalConnectionPoint: Point2D) {
        this.#data.normalConnectionPoint = normalConnectionPoint;
    }

    get normalSide(): NormalSide {
        return this.#data.normalSide;
    }

    set normalSide(normalSide: NormalSide) {
        this.#data.normalSide = normalSide;
    }

    get isHole(): boolean | undefined {
        return this.#data.isHole;
    }

    get holeUnderspeedPercent(): number | undefined {
        return this.#data.holeUnderspeedPercent;
    }

    get rapidIn(): Rapid | undefined {
        return this.#data.rapidIn;
    }

    get leadInConfig(): LeadConfig | undefined {
        return this.#data.leadInConfig;
    }

    get leadOutConfig(): LeadConfig | undefined {
        return this.#data.leadOutConfig;
    }

    get leadIn(): CacheableLead | undefined {
        return this.#data.leadIn;
    }

    set leadIn(leadIn: CacheableLead) {
        this.#data.leadIn = leadIn;
    }

    get leadOut(): CacheableLead | undefined {
        return this.#data.leadOut;
    }

    set leadOut(leadOut: CacheableLead) {
        this.#data.leadOut = leadOut;
    }

    get kerfWidth(): number | undefined {
        return this.#data.kerfWidth;
    }

    get kerfCompensation(): OffsetDirection | undefined {
        return this.#data.kerfCompensation;
    }

    get offset(): Offset | undefined {
        return this.#data.offset ? new Offset(this.#data.offset) : undefined;
    }

    toData(): CutData {
        return this.#data;
    }
}
