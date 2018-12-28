/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { defaultLogger, Logger } from "../logger";
import { Match, matches } from "../match";
import { Spy } from "../spy-interface";
import { getSubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";
import { BasePlugin, Notification } from "./plugin";

const graphRefSymbol = Symbol("graphRef");

export interface GraphRef {
    depth: number;
    flats: Subscription[];
    flatsFlushed: number;
    flattened: boolean;
    link: GraphRef;
    rootSink: Subscription | undefined;
    self: Subscription;
    sentinel: GraphRef;
    sink: Subscription | undefined;
    sources: Subscription[];
    sourcesFlushed: number;
}

export class GraphPlugin extends BasePlugin {

    private flushIntervalId_: any;
    private flushQueue_: { due: number, flush: Function }[];
    private keptDuration_: number;
    private notifications_: {
        notification: Notification;
        subscription: Subscription;
    }[];
    private sentinel_: GraphRef;

    constructor({
        keptDuration = 30000,
        spy
    }: {
        keptDuration?: number,
        spy: Spy
    }) {

        super("graph");

        this.flushIntervalId_ = undefined;
        this.flushQueue_ = [];
        this.keptDuration_ = keptDuration;
        this.notifications_ = [];
        this.sentinel_ = {
            depth: 0,
            flats: [],
            flatsFlushed: 0,
            flattened: false,
            link: undefined!,
            rootSink: undefined,
            self: undefined!,
            sentinel: undefined!,
            sink: undefined,
            sources: [],
            sourcesFlushed: 0
        };
        this.sentinel_.link = this.sentinel_;
        this.sentinel_.sentinel = this.sentinel_;
    }

    afterNext(subscription: Subscription, value: any): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    afterSubscribe(subscription: Subscription): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    afterUnsubscribe(subscription: Subscription): void {

        const { notifications_ } = this;
        notifications_.pop();
        this.flush_(subscription);
    }

    beforeNext(subscription: Subscription, value: any): void {

        const { notifications_ } = this;
        notifications_.push({ notification: "next", subscription });
    }

    beforeSubscribe(subscription: Subscription): void {

        const { notifications_, sentinel_ } = this;
        const graphRef = this.setGraphRef_(subscription, {
            depth: 1,
            flats: [],
            flatsFlushed: 0,
            flattened: false,
            link: sentinel_,
            rootSink: undefined,
            self: subscription,
            sentinel: sentinel_,
            sink: undefined,
            sources: [],
            sourcesFlushed: 0
        });

        // Note that for next notifications, the notifications_ array will
        // contain sources and for subscribe notifications, it will contain
        // sinks.

        const length = notifications_.length;
        if ((length > 0) && (notifications_[length - 1].notification === "next")) {

            const { subscription: source } = notifications_[length - 1];
            const sourceGraphRef = this.getGraphRef(source);
            const { sink } = sourceGraphRef;
            if (sink) {
                const sinkGraphRef = this.getGraphRef(sink);
                sinkGraphRef.flats.push(subscription);
                graphRef.link = sinkGraphRef;
                graphRef.flattened = true;
                graphRef.rootSink = sinkGraphRef.rootSink || sink;
                graphRef.sink = sink;
            }
        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const { subscription: sink } = notifications_[length - 1];
                    const sinkGraphRef = this.getGraphRef(sink);
                    sinkGraphRef.sources.push(subscription);
                    graphRef.depth = sinkGraphRef.depth + 1;
                    graphRef.link = sinkGraphRef;
                    graphRef.rootSink = sinkGraphRef.rootSink || sink;
                    graphRef.sink = sink;

                    break;
                }
            }
        }

        if (graphRef.link === graphRef.sentinel) {
            graphRef.sentinel.sources.push(subscription);
        }

        notifications_.push({ notification: "subscribe", subscription });
    }

    beforeUnsubscribe(subscription: Subscription): void {

        const { notifications_ } = this;
        notifications_.push({ notification: "unsubscribe", subscription });
    }

    findRootSubscriptions(): Subscription[] {

        const { sentinel_ } = this;
        return sentinel_ ? sentinel_.sources : [];
    }

    findSubscription(match: Match): Subscription | undefined {

        const { sentinel_ } = this;
        return this.findSubscription_(sentinel_, match);
    }

    teardown(): void {

        if (this.flushIntervalId_ !== undefined) {
            clearInterval(this.flushIntervalId_);
            this.flushIntervalId_ = undefined;
        }
    }

    getGraphRef(subscription: Subscription): GraphRef {

        return subscription[graphRefSymbol];
    }

    logGraph(subscription?: Subscription, logger: Logger = defaultLogger): void {

        const log = (indent: string, source: Subscription, kind: string) => {
            const { observable } = getSubscriptionRef(source);
            logger.log(`${indent}${inferType(observable)} (${kind})`);
            const graphRef = this.getGraphRef(source);
            graphRef.sources.forEach(source => log(`${indent}  `, source, "source"));
            graphRef.flats.forEach(flat => log(`${indent}  `, flat, "flat"));
        };

        if (subscription) {
            log("", subscription, "subscription");
        } else {
            const { sentinel_ } = this;
            sentinel_.sources.forEach(source => log("", source, "root"));
        }
    }

    private flush_(subscription: Subscription): void {

        const graphRef = this.getGraphRef(subscription);
        const { flats, sources } = graphRef;

        if (
            (getSubscriptionRef(subscription).unsubscribeTimestamp === 0) ||
            flats.some(flat => getSubscriptionRef(flat).unsubscribeTimestamp === 0) ||
            sources.some(source => getSubscriptionRef(source).unsubscribeTimestamp === 0)
        ) {
            return;
        }

        const { keptDuration_ } = this;
        const { link } = graphRef;

        const flush = () => {
            const { flats, sources } = link;
            const flatIndex = flats.indexOf(subscription);
            if (flatIndex !== -1) {
                flats.splice(flatIndex, 1);
                ++link.flatsFlushed;
            }
            const sourceIndex = sources.indexOf(subscription);
            if (sourceIndex !== -1) {
                sources.splice(sourceIndex, 1);
                ++link.sourcesFlushed;
            }
        };

        if (keptDuration_ === 0) {
            flush();
        } else if ((keptDuration_ > 0) && (keptDuration_ < Infinity)) {
            this.flushQueue_.push({ due: Date.now() + keptDuration_, flush });
            if (this.flushIntervalId_ === undefined) {
                this.flushIntervalId_ = setInterval(() => {
                    const now = Date.now();
                    this.flushQueue_ = this.flushQueue_.filter(q => {
                        if (q.due > now) { return true; }
                        q.flush();
                        return false;
                    });
                    if (this.flushQueue_.length === 0) {
                        clearInterval(this.flushIntervalId_);
                        this.flushIntervalId_ = undefined;
                    }
                }, keptDuration_);
            }
        }
    }

    private findSubscription_(
        graphRef: GraphRef,
        match: Match
    ): Subscription | undefined {

        const { flats, self, sources } = graphRef;

        const iter = (
            found: Subscription | undefined,
            subscription: Subscription
        ) => {
            if (found) {
                return found;
            }
            return this.findSubscription_(
                this.getGraphRef(subscription),
                match
            );
        };

        if (self && matches(self, match)) {
            return self;
        }
        return sources.reduce(iter, undefined) || flats.reduce(iter, undefined);
    }

    private setGraphRef_(subscription: Subscription, value: GraphRef): GraphRef {

        subscription[graphRefSymbol] = value;
        return value;
    }
}
