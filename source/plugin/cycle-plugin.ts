/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Logger, PartialLogger, toLogger } from "../logger";
import { BasePlugin } from "./plugin";
import { Spy } from "../spy-interface";
import { getStackTrace } from "./stack-trace-plugin";
import { SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";

const cycleSymbol = Symbol("cycle");

export class CyclePlugin extends BasePlugin {

    private logger_: Logger;
    private nexts_: SubscriptionRef[] = [];
    private spy_: Spy;

    constructor(spy: Spy, partialLogger: PartialLogger) {

        super("cycle");

        this.logger_ = toLogger(partialLogger);
        this.spy_ = spy;
    }

    afterNext(ref: SubscriptionRef, value: any): void {

        const { nexts_ } = this;
        nexts_.pop();
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { logger_, nexts_, spy_ } = this;
        const { observable, subscription } = ref;

        if (nexts_.indexOf(ref) !== -1) {
            if (!subscription[cycleSymbol]) {
                const stackFrames = getStackTrace(ref);
                if (stackFrames.length === 0) {
                    spy_.warnOnce(console, "Stack tracing is not enabled; add the StackTracePlugin before the CyclePlugin.");
                }
                const stackTrace = stackFrames.length ? `\n${stackFrames.join("\n")}` : "";
                const type = inferType(observable);
                logger_.warn(`Cyclic next detected; type = ${type}; value = ${value}${stackTrace}`);
                subscription[cycleSymbol] = true;
            }
        }
        nexts_.push(ref);
    }
}
