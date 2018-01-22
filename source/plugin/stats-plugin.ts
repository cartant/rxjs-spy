/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { getGraphRef } from "./graph-plugin";
import { BasePlugin } from "./plugin";
import { Spy } from "../spy-interface";
import { SubscriberRef, SubscriptionRef } from "../subscription-ref";

export interface Stats {
    completes: number;
    errors: number;
    flattenedSubscribes: number;
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

export class StatsPlugin extends BasePlugin {

    private spy_: Spy;
    private stats_: Stats;
    private time_: number;

    constructor(spy: Spy) {

        super("stats");

        this.spy_ = spy;
        this.stats_ = {
            completes: 0,
            errors: 0,
            flattenedSubscribes: 0,
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

    afterSubscribe(ref: SubscriptionRef): void {
        const { stats_ } = this;
        const graphRef = getGraphRef(ref);
        if (graphRef) {
            const { depth, flattened, flattenings, flatteningsFlushed, rootSink, sources, sourcesFlushed } = graphRef;
            if (!rootSink) {
                stats_.rootSubscribes += 1;
            }
            if (flattened) {
                stats_.flattenedSubscribes += 1;
            }
            if ((flattenings.length + flatteningsFlushed + sources.length + sourcesFlushed) === 0) {
                if (stats_.maxDepth < depth) {
                    stats_.maxDepth = depth;
                }
                stats_.leafSubscribes += 1;
                stats_.totalDepth += depth;
            }
        }
    }

    beforeComplete(ref: SubscriptionRef): void {
        const { stats_ } = this;
        ++stats_.completes;
        this.all_();
    }

    beforeError(ref: SubscriptionRef, error: any): void {
        const { stats_ } = this;
        ++stats_.errors;
        this.all_();
    }

    beforeNext(ref: SubscriptionRef, value: any): void {
        const { stats_ } = this;
        ++stats_.nexts;
        this.all_();
    }

    beforeSubscribe(ref: SubscriberRef): void {
        const { stats_ } = this;
        ++stats_.subscribes;
        this.all_();
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {
        const { stats_ } = this;
        ++stats_.unsubscribes;
        this.all_();
    }

    public get stats(): Stats {
        const { stats_ } = this;
        return { ...stats_ };
    }

    private all_(): void {
        const { spy_, stats_, time_ } = this;
        if (time_ === 0) {
            this.time_ = Date.now();
        } else {
            stats_.timespan = Date.now() - time_;
        }
        stats_.tick = spy_.tick;
    }
}
