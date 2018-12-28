/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Logger } from "../logger";
import { Spy } from "../spy-interface";
import { getSubscriptionLabel, SubscriptionLabel } from "../subscription-label";
import { inferType } from "../util";
import { GraphLabel, GraphPlugin } from "./graph-plugin";
import { BasePlugin } from "./plugin";
import { SnapshotLabel, SnapshotPlugin } from "./snapshot-plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

const bufferLabelHigherOrderSymbol = Symbol("bufferLabelHigherOrder");
const bufferLabelSymbol = Symbol("bufferLabel");

interface BufferLabel {
    sinkGraphLabel: GraphLabel;
    sinkSnapshotLabel: SnapshotLabel | undefined;
    sinkSubscriptionLabel: SubscriptionLabel;
    sourceSubscriptionLabels: SubscriptionLabel[];
    warned: boolean;
}

const higherOrderRegExp = /^(zip)$/;
const subscriptions: Subscription[] = [];
const unboundedRegExp = /^(buffer|bufferTime|bufferToggle|bufferWhen|delay|delayWhen|mergeMap|zip)$/;

type FindPlugins = {
    graphPlugin: GraphPlugin | undefined;
    snapshotPlugin: SnapshotPlugin | undefined;
    stackTracePlugin: StackTracePlugin | undefined;
};

export class BufferPlugin extends BasePlugin {

    private bufferThreshold_: number;
    private foundPlugins_: FindPlugins | undefined;
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

        const bufferLabel = this.getBufferLabel_(subscription);
        if (!bufferLabel) {
            return;
        }

        const {
            sinkGraphLabel,
            sinkSnapshotLabel,
            sinkSubscriptionLabel,
            sourceSubscriptionLabels
        } = bufferLabel;

        const inputCount = sourceSubscriptionLabels.reduce((count, sourceSubscriptionLabel) => {
            return Math.max(count, sourceSubscriptionLabel.nextCount);
        }, 0);
        const flatsCount = sinkGraphLabel.flats.length + sinkGraphLabel.flatsFlushed;
        const outputCount = flatsCount || sinkSubscriptionLabel.nextCount;

        const { bufferThreshold_, logger_ } = this;
        const bufferCount = inputCount - outputCount;
        if ((bufferCount >= bufferThreshold_) && !bufferLabel.warned) {
            bufferLabel.warned = true;
            const { stackTracePlugin } = this.findPlugins_();
            const stackTrace = stackTracePlugin ?
                `; subscribed at\n${stackTracePlugin.getStackTrace(sinkGraphLabel.rootSink || sinkSubscriptionLabel.subscription).join("\n")}` :
                "";
            const type = inferType(sinkSubscriptionLabel.observable);
            logger_.warn(`Excessive buffering detected; type = ${type}; count = ${bufferCount}${stackTrace}`);
        }
        if (sinkSnapshotLabel) {
            sinkSnapshotLabel.query.bufferCount = bufferCount;
        }
    }

    afterSubscribe(subscription: Subscription): void {

        subscriptions.pop();
    }

    beforeSubscribe(subscription: Subscription): void {

        const { snapshotPlugin } = this.findPlugins_();
        const snapshotLabel = snapshotPlugin ?
            snapshotPlugin.getSnapshotLabel(subscription) :
            undefined;
        if (snapshotLabel) {
            snapshotLabel.query.bufferCount = 0;
        }

        const subscriptionLabel = getSubscriptionLabel(subscription);
        subscriptions.push(subscription);
        const length = subscriptions.length;
        if (length > 1) {
            const bufferLabel = this.getHigherOrderBufferLabel_(subscriptions[length - 2]);
            if (bufferLabel) {
                bufferLabel.sourceSubscriptionLabels.push(subscriptionLabel);
                this.setBufferLabel_(subscription, bufferLabel);
                return;
            }
        }

        const { graphPlugin } = this.findPlugins_();
        if (!graphPlugin) {
            return;
        }

        const graphLabel = graphPlugin.getGraphLabel(subscription);
        const { sink } = graphLabel;
        if (!sink) {
            return;
        }

        const sinkSubscriptionLabel = getSubscriptionLabel(sink);
        const sinkObservableType = inferType(sinkSubscriptionLabel.observable);
        if (!unboundedRegExp.test(sinkObservableType)) {
            return;
        }

        let bufferLabel = this.getBufferLabel_(sink);
        if (!bufferLabel) {
            bufferLabel = this.setBufferLabel_(sink, {
                sinkGraphLabel: graphPlugin.getGraphLabel(sink),
                sinkSnapshotLabel: snapshotPlugin ?
                    snapshotPlugin.getSnapshotLabel(sink) :
                    undefined,
                sinkSubscriptionLabel,
                sourceSubscriptionLabels: [],
                warned: false
            });
        }

        if (higherOrderRegExp.test(sinkObservableType)) {
            this.setHigherOrderBufferLabel_(subscription, bufferLabel);
        } else {
            bufferLabel.sourceSubscriptionLabels.push(subscriptionLabel);
            this.setBufferLabel_(subscription, bufferLabel);
        }
    }

    private findPlugins_(): FindPlugins {

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

    private getBufferLabel_(subscription: Subscription): BufferLabel {
        return subscription[bufferLabelSymbol];
    }

    private getHigherOrderBufferLabel_(subscription: Subscription): BufferLabel {
        return subscription[bufferLabelHigherOrderSymbol];
    }

    private setBufferLabel_(subscription: Subscription, label: BufferLabel): BufferLabel {
        subscription[bufferLabelSymbol] = label;
        return label;
    }

    private setHigherOrderBufferLabel_(subscription: Subscription, label: BufferLabel): BufferLabel {
        subscription[bufferLabelHigherOrderSymbol] = label;
        return label;
    }
}
