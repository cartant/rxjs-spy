/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Logger } from "../logger";
import { Spy } from "../spy-interface";
import { getSubscriptionRef, SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";
import { getGraphRef, GraphRef } from "./graph-plugin";
import { BasePlugin } from "./plugin";
import { getSnapshotRef, SnapshotRef } from "./snapshot-plugin";
import { getStackTrace } from "./stack-trace-plugin";

interface BufferRef {
    sink: SubscriptionRef;
    sinkGraphRef: GraphRef;
    sinkSnapshotRef: SnapshotRef;
    sources: SubscriptionRef[];
    warned: boolean;
}

const bufferHigherOrderSymbol = Symbol("bufferHigherOrder");
const bufferRefSymbol = Symbol("bufferRef");

const higherOrderRegExp = /^(zip)$/;
const subscriptions: SubscriptionRef[] = [];
const unboundedRegExp = /^(buffer|bufferTime|bufferToggle|bufferWhen|delay|delayWhen|mergeMap|zip)$/;

export class BufferPlugin extends BasePlugin {

    private bufferThreshold_: number;
    private logger_: Logger;
    private spy_: Spy;

    constructor({
        bufferThreshold = 100,
        spy
    }: {
        bufferThreshold?: number,
        spy: Spy
    }) {

        super("buffer");

        this.bufferThreshold_ = bufferThreshold;
        this.logger_ = spy.logger;
        this.spy_ = spy;
    }

    afterNext(subscription: Subscription, value: any): void {

        const subscriptionRef = getSubscriptionRef(subscription);
        const bufferRef: BufferRef = subscriptionRef[bufferRefSymbol];
        if (!bufferRef) {
            return;
        }

        const { sink, sinkGraphRef, sinkSnapshotRef, sources } = bufferRef;
        const inputCount = sources.reduce((count, source) => {
            return Math.max(count, source.nextCount);
        }, 0);
        const flatsCount = sinkGraphRef.flats.length + sinkGraphRef.flatsFlushed;
        const outputCount = flatsCount || sink.nextCount;

        const { bufferThreshold_, logger_, spy_ } = this;
        const bufferCount = inputCount - outputCount;
        if ((bufferCount >= bufferThreshold_) && !bufferRef.warned) {
            bufferRef.warned = true;
            const stackFrames = getStackTrace(sinkGraphRef.rootSink || sink);
            if (stackFrames.length === 0) {
                spy_.logger.warnOnce("Stack tracing is not enabled; add the StackTracePlugin before the CyclePlugin.");
            }
            const stackTrace = stackFrames.length ? `; subscribed at\n${stackFrames.join("\n")}` : "";
            const type = inferType(sink.observable);
            logger_.warn(`Excessive buffering detected; type = ${type}; count = ${bufferCount}${stackTrace}`);
        }
        if (sinkSnapshotRef) {
            sinkSnapshotRef.query.bufferCount = bufferCount;
        }
    }

    afterSubscribe(subscription: Subscription): void {

        subscriptions.pop();
    }

    beforeSubscribe(subscription: Subscription): void {

        const subscriptionRef = getSubscriptionRef(subscription);
        const snapshotRef = getSnapshotRef(subscriptionRef);
        if (snapshotRef) {
            snapshotRef.query.bufferCount = 0;
        }

        subscriptions.push(subscriptionRef);
        const length = subscriptions.length;
        if (length > 1) {
            const bufferRef = subscriptions[length - 2][bufferHigherOrderSymbol];
            if (bufferRef) {
                bufferRef.sources.push(subscriptionRef);
                subscriptionRef[bufferRefSymbol] = bufferRef;
                return;
            }
        }

        const graphRef = getGraphRef(subscriptionRef);
        if (!graphRef) {
            this.spy_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the BufferPlugin.");
            return;
        }

        const { sink } = graphRef;
        if (!sink || !unboundedRegExp.test(inferType(sink.observable))) {
            return;
        }

        let bufferRef = sink[bufferRefSymbol];
        if (!bufferRef) {
            bufferRef = sink[bufferRefSymbol] = {
                sink,
                sinkGraphRef: getGraphRef(sink),
                sinkSnapshotRef: getSnapshotRef(sink),
                sources: [],
                warned: false
            };
        }

        if (higherOrderRegExp.test(inferType(sink.observable))) {
            subscriptionRef[bufferHigherOrderSymbol] = bufferRef;
        } else {
            bufferRef.sources.push(subscriptionRef);
            subscriptionRef[bufferRefSymbol] = bufferRef;
        }
    }
}
