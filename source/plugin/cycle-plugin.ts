/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Logger, PartialLogger, toLogger } from "../logger";
import { BasePlugin } from "./plugin";
import { getSnapshotRef } from "./snapshot-plugin";
import { Spy } from "../spy-interface";
import { getStackTrace } from "./stack-trace-plugin";
import { SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";

const cycleCountSymbol = Symbol("cycleCount");
const cycleWarnedSymbol = Symbol("cycleWarned");

export class CyclePlugin extends BasePlugin {

    private cycleThreshold_: number;
    private logger_: Logger;
    private nexts_: SubscriptionRef[] = [];
    private spy_: Spy;

    constructor(spy: Spy, {
        cycleThreshold = 100,
        logger
    }: {
        cycleThreshold?: number,
        logger: PartialLogger
    }) {

        super("cycle");

        this.cycleThreshold_ = cycleThreshold;
        this.logger_ = toLogger(logger);
        this.spy_ = spy;
    }

    afterNext(ref: SubscriptionRef, value: any): void {

        const { nexts_ } = this;
        nexts_.pop();
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { cycleThreshold_, logger_, nexts_, spy_ } = this;
        const { observable, subscription } = ref;

        if (nexts_.indexOf(ref) !== -1) {
            const cycleCount = subscription[cycleCountSymbol] = (subscription[cycleCountSymbol] || 0) + 1;
            if (cycleCount >= cycleThreshold_) {
                if (nexts_.findIndex(n => n.subscription[cycleWarnedSymbol]) === -1) {
                    subscription[cycleWarnedSymbol] = true;
                    const stackFrames = getStackTrace(ref);
                    if (stackFrames.length === 0) {
                        spy_.warnOnce(console, "Stack tracing is not enabled; add the StackTracePlugin before the CyclePlugin.");
                    }
                    const stackTrace = stackFrames.length ? `; subscribed at\n${stackFrames.join("\n")}` : "";
                    const type = inferType(observable);
                    logger_.warn(`Cyclic next detected; type = ${type}; value = ${value}${stackTrace}`);
                }
            }
            const snapshotRef = getSnapshotRef(ref);
            if (snapshotRef) {
                snapshotRef.query.cycleCount = cycleCount;
            }
        }
        nexts_.push(ref);
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const snapshotRef = getSnapshotRef(ref);
        if (snapshotRef) {
            snapshotRef.query.cycleCount = 0;
        }
    }
}
