/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { getGraphRef } from "./graph-plugin";
import { Logger, PartialLogger, toLogger } from "../logger";
import { BasePlugin } from "./plugin";
import { getSnapshotRef } from "./snapshot-plugin";
import { Spy } from "../spy-interface";
import { getStackTrace } from "./stack-trace-plugin";
import { SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";

const bufferSinkSymbol = Symbol("bufferSink");
const bufferWarnedSymbol = Symbol("bufferWarned");

const unboundedRegExp = /^(buffer|bufferTime|bufferToggle|bufferWhen|delay|delayWhen|mergeMap|zip)$/;

export class BufferPlugin extends BasePlugin {

    private bufferThreshold_: number;
    private logger_: Logger;
    private spy_: Spy;

    constructor(spy: Spy, {
        bufferThreshold = 100,
        logger
    }: {
        bufferThreshold?: number,
        logger: PartialLogger
    }) {

        super("buffer");

        this.bufferThreshold_ = bufferThreshold;
        this.logger_ = toLogger(logger);
        this.spy_ = spy;
    }

    afterNext(ref: SubscriptionRef, value: any): void {

        const sink: SubscriptionRef = ref[bufferSinkSymbol];
        if (!sink) {
            return;
        }

        const sinkGraphRef = getGraphRef(sink);
        const sinkSnapshotRef = getSnapshotRef(sink);

        const inputCount = sinkGraphRef.sources.reduce((count, sourceSubscriptionRef) => {
            const sourceSnapshotRef = getSnapshotRef(sourceSubscriptionRef);
            return Math.max(count, sourceSnapshotRef.values.length + sourceSnapshotRef.valuesFlushed);
        }, 0);
        const flatteningsCount = sinkGraphRef.flattenings.length + sinkGraphRef.flatteningsFlushed;
        const outputCount = flatteningsCount || sinkSnapshotRef.values.length + sinkSnapshotRef.valuesFlushed;

        const { bufferThreshold_, logger_, spy_ } = this;
        const bufferCount = inputCount - outputCount;
        if ((bufferCount >= bufferThreshold_) && !sink[bufferWarnedSymbol]) {
            sink[bufferWarnedSymbol] = true;
            const stackFrames = getStackTrace(sinkGraphRef.rootSink || sink);
            if (stackFrames.length === 0) {
                spy_.warnOnce(console, "Stack tracing is not enabled; add the StackTracePlugin before the CyclePlugin.");
            }
            const stackTrace = stackFrames.length ? `; subscribed at\n${stackFrames.join("\n")}` : "";
            const type = inferType(sink.observable);
            logger_.warn(`Excessive buffering detected; type = ${type}; count = ${bufferCount}${stackTrace}`);
        }
    }

    afterSubscribe(ref: SubscriptionRef): void {

        const graphRef = getGraphRef(ref);
        if (!graphRef) {
            this.spy_.warnOnce(console, "Graphing is not enabled; add the GraphPlugin before the SnapshotPlugin.");
            return;
        }

        const { sink } = graphRef;
        if (!sink || !unboundedRegExp.test(inferType(sink.observable))) {
            return;
        }

        const sinkSnapshotRef = getSnapshotRef(sink);
        if (!sinkSnapshotRef) {
            this.spy_.warnOnce(console, "Snapshotting is not enabled; add the SnapshotPlugin before the BufferPlugin.");
            return;
        }

        ref[bufferSinkSymbol] = sink;
    }
}
