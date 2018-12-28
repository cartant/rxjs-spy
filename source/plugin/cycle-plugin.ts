/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Logger } from "../logger";
import { Spy } from "../spy-interface";
import { getSubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";
import { BasePlugin } from "./plugin";
import { getSnapshotRef } from "./snapshot-plugin";
import { getStackTrace } from "./stack-trace-plugin";

const cycleCountSymbol = Symbol("cycleCount");
const cycleWarnedSymbol = Symbol("cycleWarned");

export class CyclePlugin extends BasePlugin {

    private cycleThreshold_: number;
    private logger_: Logger;
    private nexts_: Subscription[] = [];
    private spy_: Spy;

    constructor({
        cycleThreshold = 100,
        spy
    }: {
        cycleThreshold?: number,
        spy: Spy
    }) {

        super("cycle");

        this.cycleThreshold_ = cycleThreshold;
        this.logger_ = spy.logger;
        this.spy_ = spy;
    }

    afterNext(subscription: Subscription, value: any): void {

        const { nexts_ } = this;
        nexts_.pop();
    }

    beforeNext(subscription: Subscription, value: any): void {

        const { cycleThreshold_, logger_, nexts_, spy_ } = this;

        if (nexts_.indexOf(subscription) !== -1) {
            const cycleCount = subscription[cycleCountSymbol] = (subscription[cycleCountSymbol] || 0) + 1;
            if (cycleCount >= cycleThreshold_) {
                if (nexts_.findIndex(next => next[cycleWarnedSymbol]) === -1) {
                    subscription[cycleWarnedSymbol] = true;
                    const stackFrames = getStackTrace(subscription);
                    if (stackFrames.length === 0) {
                        spy_.logger.warnOnce("Stack tracing is not enabled; add the StackTracePlugin before the CyclePlugin.");
                    }
                    const stackTrace = stackFrames.length ? `; subscribed at\n${stackFrames.join("\n")}` : "";
                    const { observable } = getSubscriptionRef(subscription);
                    const type = inferType(observable);
                    logger_.warn(`Cyclic next detected; type = ${type}; value = ${value}${stackTrace}`);
                }
            }
            const snapshotRef = getSnapshotRef(subscription);
            if (snapshotRef) {
                snapshotRef.query.cycleCount = cycleCount;
            }
        }
        nexts_.push(subscription);
    }

    beforeSubscribe(subscription: Subscription): void {

        const snapshotRef = getSnapshotRef(subscription);
        if (snapshotRef) {
            snapshotRef.query.cycleCount = 0;
        }
    }
}
