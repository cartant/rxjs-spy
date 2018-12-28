/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Logger } from "../logger";
import { Spy } from "../spy-interface";
import { getSubscriptionRef, SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";
import { GraphPlugin, GraphRef } from "./graph-plugin";
import { BasePlugin } from "./plugin";
import { SnapshotPlugin, SnapshotRef } from "./snapshot-plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

const bufferRefHigherOrderSymbol = Symbol("bufferRefHigherOrder");
const bufferRefSymbol = Symbol("bufferRef");

interface BufferRef {
    sinkGraphRef: GraphRef;
    sinkSnapshotRef: SnapshotRef | undefined;
    sinkSubscriptionRef: SubscriptionRef;
    sourceSubscriptionRefs: SubscriptionRef[];
    warned: boolean;
}

const higherOrderRegExp = /^(zip)$/;
const subscriptions: Subscription[] = [];
const unboundedRegExp = /^(buffer|bufferTime|bufferToggle|bufferWhen|delay|delayWhen|mergeMap|zip)$/;

export class BufferPlugin extends BasePlugin {

    private bufferThreshold_: number;
    private foundPlugins_: {
        graphPlugin: GraphPlugin | undefined;
        snapshotPlugin: SnapshotPlugin | undefined;
        stackTracePlugin: StackTracePlugin | undefined;
    } | undefined;
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
        this.foundPlugins_ = undefined;
        this.logger_ = spy.logger;
        this.spy_ = spy;
    }

    afterNext(subscription: Subscription, value: any): void {

        const bufferRef = this.getBufferRef_(subscription);
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

        const { bufferThreshold_, logger_ } = this;
        const bufferCount = inputCount - outputCount;
        if ((bufferCount >= bufferThreshold_) && !bufferRef.warned) {
            bufferRef.warned = true;
            const { stackTracePlugin } = this.findPlugins_();
            const stackTrace = stackTracePlugin ?
                `; subscribed at\n${stackTracePlugin.getStackTrace(sinkGraphRef.rootSink || sinkSubscriptionRef.subscription).join("\n")}` :
                "";
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

        const { snapshotPlugin } = this.findPlugins_();
        const snapshotRef = snapshotPlugin ?
            snapshotPlugin.getSnapshotRef(subscription) :
            undefined;
        if (snapshotRef) {
            snapshotRef.query.bufferCount = 0;
        }

        const subscriptionRef = getSubscriptionRef(subscription);
        subscriptions.push(subscription);
        const length = subscriptions.length;
        if (length > 1) {
            const bufferRef = this.getHigherOrderBufferRef_(subscriptions[length - 2]);
            if (bufferRef) {
                bufferRef.sourceSubscriptionRefs.push(subscriptionRef);
                this.setBufferRef_(subscription, bufferRef);
                return;
            }
        }

        const { graphPlugin } = this.findPlugins_();
        if (!graphPlugin) {
            return;
        }

        const graphRef = graphPlugin.getGraphRef(subscription);
        const { sink } = graphRef;
        if (!sink) {
            return;
        }

        const sinkSubscriptionRef = getSubscriptionRef(sink);
        const sinkObservableType = inferType(sinkSubscriptionRef.observable);
        if (!unboundedRegExp.test(sinkObservableType)) {
            return;
        }

        let bufferRef = this.getBufferRef_(sink);
        if (!bufferRef) {
            bufferRef = this.setBufferRef_(sink, {
                sinkGraphRef: graphPlugin.getGraphRef(sink),
                sinkSnapshotRef: snapshotPlugin ?
                    snapshotPlugin.getSnapshotRef(sink) :
                    undefined,
                sinkSubscriptionRef,
                sourceSubscriptionRefs: [],
                warned: false
            });
        }

        if (higherOrderRegExp.test(sinkObservableType)) {
            this.setHigherOrderBufferRef_(subscription, bufferRef);
        } else {
            bufferRef.sourceSubscriptionRefs.push(subscriptionRef);
            this.setBufferRef_(subscription, bufferRef);
        }
    }

    private findPlugins_(): {
        graphPlugin: GraphPlugin | undefined,
        snapshotPlugin: SnapshotPlugin | undefined,
        stackTracePlugin: StackTracePlugin | undefined
    } {

        const { foundPlugins_, spy_ } = this;
        if (foundPlugins_) {
            return foundPlugins_;
        }

        const [graphPlugin] = spy_.find(GraphPlugin);
        const [snapshotPlugin] = spy_.find(SnapshotPlugin);
        const [stackTracePlugin] = spy_.find(StackTracePlugin);

        if (!graphPlugin) {
            this.spy_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the BufferPlugin.");
        }
        if (!stackTracePlugin) {
            spy_.logger.warnOnce("Stack tracing is not enabled; add the StackTracePlugin before the BufferPlugin.");
        }

        this.foundPlugins_ = { graphPlugin, snapshotPlugin, stackTracePlugin };
        return this.foundPlugins_;
    }

    private getBufferRef_(subscription: Subscription): BufferRef {
        return subscription[bufferRefSymbol];
    }

    private getHigherOrderBufferRef_(subscription: Subscription): BufferRef {
        return subscription[bufferRefHigherOrderSymbol];
    }

    private setBufferRef_(subscription: Subscription, value: BufferRef): BufferRef {
        subscription[bufferRefSymbol] = value;
        return value;
    }

    private setHigherOrderBufferRef_(subscription: Subscription, value: BufferRef): BufferRef {
        subscription[bufferRefHigherOrderSymbol] = value;
        return value;
    }
}
