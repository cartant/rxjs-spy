/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { Logger } from "../logger";
import { getSubscriptionRecord } from "../subscription-record";
import { inferName } from "../util";
import { BasePlugin, PluginHost } from "./plugin";
import { SnapshotPlugin } from "./snapshot-plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

const cycleCountSymbol = Symbol("cycleCount");
const cycleWarnedSymbol = Symbol("cycleWarned");

type FoundPlugins = {
    snapshotPlugin: SnapshotPlugin | undefined;
    stackTracePlugin: StackTracePlugin | undefined;
};

export class CyclePlugin extends BasePlugin {

    private cycleThreshold_: number;
    private foundPlugins_: FoundPlugins | undefined;
    private logger_: Logger;
    private nexts_: Subscription[] = [];
    private pluginHost_: PluginHost;

    constructor({
        cycleThreshold = 100,
        pluginHost
    }: {
        cycleThreshold?: number,
        pluginHost: PluginHost
    }) {

        super("cycle");

        this.cycleThreshold_ = cycleThreshold;
        this.foundPlugins_ = undefined;
        this.logger_ = pluginHost.logger;
        this.pluginHost_ = pluginHost;
    }

    afterNext(subscription: Subscription, value: any): void {

        const { nexts_ } = this;
        nexts_.pop();
    }

    beforeNext(subscription: Subscription, value: any): void {

        const { cycleThreshold_, logger_, nexts_ } = this;

        if (nexts_.indexOf(subscription) !== -1) {
            const cycleCount = subscription[cycleCountSymbol] = (subscription[cycleCountSymbol] || 0) + 1;
            if (cycleCount >= cycleThreshold_) {
                if (nexts_.findIndex(next => next[cycleWarnedSymbol]) === -1) {
                    subscription[cycleWarnedSymbol] = true;
                    const { stackTracePlugin } = this.findPlugins_();
                    const stackTrace = stackTracePlugin ?
                        `; subscribed at\n${stackTracePlugin.getStackTrace(subscription).join("\n")}` :
                        "";
                    const { observable } = getSubscriptionRecord(subscription);
                    const name = inferName(observable);
                    logger_.warn(`Cyclic next detected; name = ${name}; value = ${value}${stackTrace}`);
                }
            }

            const { snapshotPlugin } = this.findPlugins_();
            if (snapshotPlugin) {
                const snapshotRecord = snapshotPlugin.getSnapshotRecord(subscription);
                snapshotRecord.queryRecord.cycleCount = cycleCount;
            }
        }
        nexts_.push(subscription);
    }

    beforeSubscribe(subscription: Subscription): void {

        const { snapshotPlugin } = this.findPlugins_();
        if (snapshotPlugin) {
            const snapshotRecord = snapshotPlugin.getSnapshotRecord(subscription);
            snapshotRecord.queryRecord.cycleCount = 0;
        }
    }

    private findPlugins_(): FoundPlugins {

        const { foundPlugins_, pluginHost_ } = this;
        if (foundPlugins_) {
            return foundPlugins_;
        }

        const [snapshotPlugin] = pluginHost_.findPlugins(SnapshotPlugin, CyclePlugin);
        const [stackTracePlugin] = pluginHost_.findPlugins(StackTracePlugin, CyclePlugin);

        if (!stackTracePlugin) {
            pluginHost_.logger.warnOnce("Stack tracing is not enabled; add the StackTracePlugin before the CyclePlugin.");
        }

        this.foundPlugins_ = { snapshotPlugin, stackTracePlugin };
        return this.foundPlugins_;
    }
}
