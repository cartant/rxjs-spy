/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { GraphPlugin, GraphRecord } from "./graph-plugin";
import { BasePlugin, PluginHost } from "./plugin";

type FoundPlugins = {
    graphPlugin: GraphPlugin | undefined;
};

export class SweepPlugin extends BasePlugin {

    id: string;
    innerSubscriptions: Map<Subscription, GraphRecord>;
    innerUnsubscriptions: Map<Subscription, GraphRecord>;
    rootSubscriptions: Map<Subscription, GraphRecord>;
    rootUnsubscriptions: Map<Subscription, GraphRecord>;

    private foundPlugins_: FoundPlugins | undefined;
    private pluginHost_: PluginHost;

    constructor({ id, pluginHost }: { id: string, pluginHost: PluginHost }) {
        super("sweep");
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
        } else {
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
        } else {
            this.rootSubscriptions.set(subscription, graphRecord);
        }
    }

    flush(): void {
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
        const [graphPlugin] = pluginHost_.find(GraphPlugin, SweepPlugin);
        if (!graphPlugin) {
            pluginHost_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the SweepPlugin.");
        }
        this.foundPlugins_ = { graphPlugin };
        return this.foundPlugins_;
    }
}
