/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Logger } from "../logger";
import { Spy } from "../spy-interface";
import { getSubscriptionRecord, SubscriptionRecord } from "../subscription-record";
import { inferType } from "../util";
import { GraphPlugin, GraphRecord } from "./graph-plugin";
import { BasePlugin } from "./plugin";
import { SnapshotPlugin, SnapshotRecord } from "./snapshot-plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

const bufferRecordHigherOrderSymbol = Symbol("bufferRecordHigherOrder");
const bufferRecordSymbol = Symbol("bufferRecord");

interface BufferRecord {
    sinkGraphRecord: GraphRecord;
    sinkSnapshotRecord: SnapshotRecord | undefined;
    sinkSubscriptionRecord: SubscriptionRecord;
    sourceSubscriptionRecords: SubscriptionRecord[];
    warned: boolean;
}

const higherOrderRegExp = /^(zip)$/;
const subscriptions: Subscription[] = [];
const unboundedRegExp = /^(buffer|bufferTime|bufferToggle|bufferWhen|delay|delayWhen|mergeMap|zip)$/;

type FoundPlugins = {
    graphPlugin: GraphPlugin | undefined;
    snapshotPlugin: SnapshotPlugin | undefined;
    stackTracePlugin: StackTracePlugin | undefined;
};

export class BufferPlugin extends BasePlugin {

    private bufferThreshold_: number;
    private foundPlugins_: FoundPlugins | undefined;
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

        const bufferRecord = this.getBufferRecord_(subscription);
        if (!bufferRecord) {
            return;
        }

        const {
            sinkGraphRecord,
            sinkSnapshotRecord,
            sinkSubscriptionRecord,
            sourceSubscriptionRecords
        } = bufferRecord;

        const inputCount = sourceSubscriptionRecords.reduce((count, sourceSubscriptionRecord) => {
            return Math.max(count, sourceSubscriptionRecord.nextCount);
        }, 0);
        const innersCount = sinkGraphRecord.inners.length + sinkGraphRecord.innersFlushed;
        const outputCount = innersCount || sinkSubscriptionRecord.nextCount;

        const { bufferThreshold_, logger_ } = this;
        const bufferCount = inputCount - outputCount;
        if ((bufferCount >= bufferThreshold_) && !bufferRecord.warned) {
            bufferRecord.warned = true;
            const { stackTracePlugin } = this.findPlugins_();
            const stackTrace = stackTracePlugin ?
                `; subscribed at\n${stackTracePlugin.getStackTrace(sinkGraphRecord.rootSink || sinkSubscriptionRecord.subscription).join("\n")}` :
                "";
            const type = inferType(sinkSubscriptionRecord.observable);
            logger_.warn(`Excessive buffering detected; type = ${type}; count = ${bufferCount}${stackTrace}`);
        }
        if (sinkSnapshotRecord) {
            sinkSnapshotRecord.queryRecord.bufferCount = bufferCount;
        }
    }

    afterSubscribe(subscription: Subscription): void {

        subscriptions.pop();
    }

    beforeSubscribe(subscription: Subscription): void {

        const { snapshotPlugin } = this.findPlugins_();
        const snapshotRecord = snapshotPlugin ?
            snapshotPlugin.getSnapshotRecord(subscription) :
            undefined;
        if (snapshotRecord) {
            snapshotRecord.queryRecord.bufferCount = 0;
        }

        const subscriptionRecord = getSubscriptionRecord(subscription);
        subscriptions.push(subscription);
        const length = subscriptions.length;
        if (length > 1) {
            const bufferRecord = this.getHigherOrderBufferRecord_(subscriptions[length - 2]);
            if (bufferRecord) {
                bufferRecord.sourceSubscriptionRecords.push(subscriptionRecord);
                this.setBufferRecord_(subscription, bufferRecord);
                return;
            }
        }

        const { graphPlugin } = this.findPlugins_();
        if (!graphPlugin) {
            return;
        }

        const graphRecord = graphPlugin.getGraphRecord(subscription);
        const { sink } = graphRecord;
        if (!sink) {
            return;
        }

        const sinkSubscriptionRecord = getSubscriptionRecord(sink);
        const sinkObservableType = inferType(sinkSubscriptionRecord.observable);
        if (!unboundedRegExp.test(sinkObservableType)) {
            return;
        }

        let bufferRecord = this.getBufferRecord_(sink);
        if (!bufferRecord) {
            bufferRecord = this.setBufferRecord_(sink, {
                sinkGraphRecord: graphPlugin.getGraphRecord(sink),
                sinkSnapshotRecord: snapshotPlugin ?
                    snapshotPlugin.getSnapshotRecord(sink) :
                    undefined,
                sinkSubscriptionRecord,
                sourceSubscriptionRecords: [],
                warned: false
            });
        }

        if (higherOrderRegExp.test(sinkObservableType)) {
            this.setHigherOrderBufferRecord_(subscription, bufferRecord);
        } else {
            bufferRecord.sourceSubscriptionRecords.push(subscriptionRecord);
            this.setBufferRecord_(subscription, bufferRecord);
        }
    }

    private findPlugins_(): FoundPlugins {

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

    private getBufferRecord_(subscription: Subscription): BufferRecord {
        return subscription[bufferRecordSymbol];
    }

    private getHigherOrderBufferRecord_(subscription: Subscription): BufferRecord {
        return subscription[bufferRecordHigherOrderSymbol];
    }

    private setBufferRecord_(subscription: Subscription, record: BufferRecord): BufferRecord {
        subscription[bufferRecordSymbol] = record;
        return record;
    }

    private setHigherOrderBufferRecord_(subscription: Subscription, record: BufferRecord): BufferRecord {
        subscription[bufferRecordHigherOrderSymbol] = record;
        return record;
    }
}
