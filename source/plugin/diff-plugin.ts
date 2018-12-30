/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { PartialLogger, toLogger } from "../logger";
import { GraphPlugin, GraphRecord } from "./graph-plugin";
import { BasePlugin, PluginHost } from "./plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

export interface Diff {
    innerSubscriptions: Subscription[];
    innerUnsubscriptions: Subscription[];
    rootSubscriptions: Subscription[];
    rootUnsubscriptions: Subscription[];
}

type FoundPlugins = {
    graphPlugin: GraphPlugin | undefined;
    stackTracePlugin: StackTracePlugin | undefined;
};

export class DiffPlugin extends BasePlugin {

    id: string;
    innerSubscriptions: Map<Subscription, GraphRecord>;
    innerUnsubscriptions: Map<Subscription, GraphRecord>;
    rootSubscriptions: Map<Subscription, GraphRecord>;
    rootUnsubscriptions: Map<Subscription, GraphRecord>;

    private foundPlugins_: FoundPlugins | undefined;
    private pluginHost_: PluginHost;

    constructor({ id, pluginHost }: { id: string, pluginHost: PluginHost }) {
        super(`diff(${id})`);
        this.foundPlugins_ = undefined;
        this.id = id;
        this.innerSubscriptions = new Map<Subscription, GraphRecord>();
        this.innerUnsubscriptions = new Map<Subscription, GraphRecord>();
        this.pluginHost_ = pluginHost;
        this.rootSubscriptions = new Map<Subscription, GraphRecord>();
        this.rootUnsubscriptions = new Map<Subscription, GraphRecord>();
    }

    afterUnsubscribe(subscription: Subscription): void {
        const { graphPlugin } = this.findPlugins_();
        if (!graphPlugin) {
            return;
        }
        const graphRecord = graphPlugin.getGraphRecord(subscription);
        if (graphRecord.inner) {
            if (!this.innerSubscriptions.delete(subscription)) {
                this.innerUnsubscriptions.set(subscription, graphRecord);
            }
        } else if (!graphRecord.sink) {
            if (!this.rootSubscriptions.delete(subscription)) {
                this.rootUnsubscriptions.set(subscription, graphRecord);
            }
        }
    }

    beforeSubscribe(subscription: Subscription): void {
        const { graphPlugin } = this.findPlugins_();
        if (!graphPlugin) {
            return;
        }
        const graphRecord = graphPlugin.getGraphRecord(subscription);
        if (graphRecord.inner) {
            this.innerSubscriptions.set(subscription, graphRecord);
        } else if (!graphRecord.sink) {
            this.rootSubscriptions.set(subscription, graphRecord);
        }
    }

    diff({ flush }: { flush?: boolean } = {}): Diff | undefined {
        const {
            innerSubscriptions,
            innerUnsubscriptions,
            rootSubscriptions,
            rootUnsubscriptions
        } = this;

        if (flush) {
            this.clear_();
            return undefined;
        }
        if ((
            innerSubscriptions.size +
            innerUnsubscriptions.size +
            rootSubscriptions.size +
            rootUnsubscriptions.size
        ) === 0) {
            return undefined;
        }
        const result = {
            innerSubscriptions: Array.from(innerSubscriptions.keys()),
            innerUnsubscriptions: Array.from(innerUnsubscriptions.keys()),
            rootSubscriptions: Array.from(rootSubscriptions.keys()),
            rootUnsubscriptions: Array.from(rootUnsubscriptions.keys())
        };
        this.clear_();
        return result;
    }

    logDiff(diff: Diff, partialLogger: PartialLogger): void {
        const { stackTracePlugin } = this.findPlugins_();
        if (!stackTracePlugin) {
            return;
        }
        const logger = toLogger(partialLogger);
        logger.group(`Subscription diff found; id = '${this.id}'`);
        diff.rootSubscriptions.forEach(s => {
            logger.log("Root subscription at", stackTracePlugin.getStackTrace(s));
        });
        diff.rootUnsubscriptions.forEach(s => {
            logger.log("Root unsubscription at", stackTracePlugin.getStackTrace(s));
        });
        diff.innerSubscriptions.forEach(s => {
            logger.log("Inner subscription at", stackTracePlugin.getStackTrace(s));
        });
        diff.innerUnsubscriptions.forEach(s => {
            logger.log("Inner unsubscription at", stackTracePlugin.getStackTrace(s));
        });
        logger.groupEnd();
    }

    private clear_(): void {
        this.innerSubscriptions.clear();
        this.innerUnsubscriptions.clear();
        this.rootSubscriptions.clear();
        this.rootUnsubscriptions.clear();
    }

    private findPlugins_(): FoundPlugins {
        const { foundPlugins_, pluginHost_ } = this;
        if (foundPlugins_) {
            return foundPlugins_;
        }
        const [graphPlugin] = pluginHost_.find(GraphPlugin, DiffPlugin);
        const [stackTracePlugin] = pluginHost_.find(StackTracePlugin, DiffPlugin);
        if (!graphPlugin) {
            pluginHost_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the DiffPlugin.");
        }
        if (!stackTracePlugin) {
            pluginHost_.logger.warnOnce("Stack tracing is not enabled; add the StackTracePlugin before the DiffPlugin.");
        }
        this.foundPlugins_ = { graphPlugin, stackTracePlugin };
        return this.foundPlugins_;
    }
}
