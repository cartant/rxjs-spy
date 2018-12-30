/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { GraphPlugin } from "./graph-plugin";
import { BasePlugin, PluginHost } from "./plugin";

export interface Stats {
    completes: number;
    errors: number;
    innerSubscribes: number;
    leafSubscribes: number;
    maxDepth: number;
    nexts: number;
    rootSubscribes: number;
    subscribes: number;
    tick: number;
    timespan: number;
    totalDepth: number;
    unsubscribes: number;
}

type FoundPlugins = {
    graphPlugin: GraphPlugin | undefined;
};

export class StatsPlugin extends BasePlugin {

    private foundPlugins_: FoundPlugins | undefined;
    private pluginHost_: PluginHost;
    private stats_: Stats;
    private time_: number;

    constructor({ pluginHost }: { pluginHost: PluginHost }) {

        super("stats");

        this.foundPlugins_ = undefined;
        this.pluginHost_ = pluginHost;
        this.stats_ = {
            completes: 0,
            errors: 0,
            innerSubscribes: 0,
            leafSubscribes: 0,
            maxDepth: 0,
            nexts: 0,
            rootSubscribes: 0,
            subscribes: 0,
            tick: 0,
            timespan: 0,
            totalDepth: 0,
            unsubscribes: 0
        };
        this.time_ = 0;
    }

    afterSubscribe(subscription: Subscription): void {

        const { graphPlugin } = this.findPlugins_();
        if (graphPlugin) {

            const { stats_ } = this;
            const {
                depth,
                inner,
                inners,
                innersFlushed,
                rootSink,
                sources,
                sourcesFlushed
            } = graphPlugin.getGraphRecord(subscription);

            if (!rootSink) {
                stats_.rootSubscribes += 1;
            }
            if (inner) {
                stats_.innerSubscribes += 1;
            }
            if ((inners.length + innersFlushed + sources.length + sourcesFlushed) === 0) {
                if (stats_.maxDepth < depth) {
                    stats_.maxDepth = depth;
                }
                stats_.leafSubscribes += 1;
                stats_.totalDepth += depth;
            }
        }
    }

    beforeComplete(subscription: Subscription): void {
        const { stats_ } = this;
        ++stats_.completes;
        this.all_();
    }

    beforeError(subscription: Subscription, error: any): void {
        const { stats_ } = this;
        ++stats_.errors;
        this.all_();
    }

    beforeNext(subscription: Subscription, value: any): void {
        const { stats_ } = this;
        ++stats_.nexts;
        this.all_();
    }

    beforeSubscribe(subscription: Subscription): void {
        const { stats_ } = this;
        ++stats_.subscribes;
        this.all_();
    }

    beforeUnsubscribe(subscription: Subscription): void {
        const { stats_ } = this;
        ++stats_.unsubscribes;
        this.all_();
    }

    public get stats(): Stats {
        const { stats_ } = this;
        return { ...stats_ };
    }

    private all_(): void {
        const { pluginHost_, stats_, time_ } = this;
        if (time_ === 0) {
            this.time_ = Date.now();
        } else {
            stats_.timespan = Date.now() - time_;
        }
        stats_.tick = pluginHost_.tick;
    }

    private findPlugins_(): FoundPlugins {

        const { foundPlugins_, pluginHost_ } = this;
        if (foundPlugins_) {
            return foundPlugins_;
        }

        const [graphPlugin] = pluginHost_.find(GraphPlugin);
        this.foundPlugins_ = { graphPlugin };
        return this.foundPlugins_;
    }
}
