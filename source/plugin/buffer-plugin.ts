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

const bufferRefHigherOrderSymbol = Symbol("bufferRefHigherOrder");
const bufferRefSymbol = Symbol("bufferRef");

interface BufferRef {
    sinkGraphRef: GraphRef;
    sinkSnapshotRef: SnapshotRef;
    sinkSubscriptionRef: SubscriptionRef;
    sourceSubscriptionRefs: SubscriptionRef[];
    warned: boolean;
}

function getBufferRef(subscription: Subscription): BufferRef {
    return subscription[bufferRefSymbol];
}

function getHigherOrderBufferRef(subscription: Subscription): BufferRef {
    return subscription[bufferRefHigherOrderSymbol];
}

function setBufferRef(subscription: Subscription, value: BufferRef): BufferRef {
    subscription[bufferRefSymbol] = value;
    return value;
}

function setHigherOrderBufferRef(subscription: Subscription, value: BufferRef): BufferRef {
    subscription[bufferRefHigherOrderSymbol] = value;
    return value;
}

const higherOrderRegExp = /^(zip)$/;
const subscriptions: Subscription[] = [];
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

        const bufferRef = getBufferRef(subscription);
        if (!bufferRef) {
            return;
        }

        const {
            sinkGraphRef,
            sinkSnapshotRef,
            sinkSubscriptionRef,
            sourceSubscriptionRefs
        } = bufferRef;

        const inputCount = sourceSubscriptionRefs.reduce((count, sourceSubscriptionRef) => {
            return Math.max(count, sourceSubscriptionRef.nextCount);
        }, 0);
        const flatsCount = sinkGraphRef.flats.length + sinkGraphRef.flatsFlushed;
        const outputCount = flatsCount || sinkSubscriptionRef.nextCount;

        const { bufferThreshold_, logger_, spy_ } = this;
        const bufferCount = inputCount - outputCount;
        if ((bufferCount >= bufferThreshold_) && !bufferRef.warned) {
            bufferRef.warned = true;
            const stackFrames = getStackTrace(sinkGraphRef.rootSink || sinkSubscriptionRef.subscription);
            if (stackFrames.length === 0) {
                spy_.logger.warnOnce("Stack tracing is not enabled; add the StackTracePlugin before the CyclePlugin.");
            }
            const stackTrace = stackFrames.length ? `; subscribed at\n${stackFrames.join("\n")}` : "";
            const type = inferType(sinkSubscriptionRef.observable);
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

        const snapshotRef = getSnapshotRef(subscription);
        if (snapshotRef) {
            snapshotRef.query.bufferCount = 0;
        }

        const subscriptionRef = getSubscriptionRef(subscription);
        subscriptions.push(subscription);
        const length = subscriptions.length;
        if (length > 1) {
            const bufferRef = getHigherOrderBufferRef(subscriptions[length - 2]);
            if (bufferRef) {
                bufferRef.sourceSubscriptionRefs.push(subscriptionRef);
                setBufferRef(subscription, bufferRef);
                return;
            }
        }

        const graphRef = getGraphRef(subscription);
        if (!graphRef) {
            this.spy_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the BufferPlugin.");
            return;
        }

        const { sink } = graphRef;
        if (!sink) {
            return;
        }

        const sinkSubscriptionRef = getSubscriptionRef(sink);
        const sinkObservableType = inferType(sinkSubscriptionRef.observable);
        if (!unboundedRegExp.test(sinkObservableType)) {
            return;
        }

        let bufferRef = getBufferRef(sink);
        if (!bufferRef) {
            bufferRef = setBufferRef(sink, {
                sinkGraphRef: getGraphRef(sink),
                sinkSnapshotRef: getSnapshotRef(sink),
                sinkSubscriptionRef,
                sourceSubscriptionRefs: [],
                warned: false
            });
        }

        if (higherOrderRegExp.test(sinkObservableType)) {
            setHigherOrderBufferRef(subscription, bufferRef);
        } else {
            bufferRef.sourceSubscriptionRefs.push(subscriptionRef);
            setBufferRef(subscription, bufferRef);
        }
    }
}
