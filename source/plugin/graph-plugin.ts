/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, OperatorFunction, Subscription } from "rxjs";
import { defaultLogger, Logger } from "../logger";
import { Match, matches } from "../match";
import { getSubscriptionRecord } from "../subscription-record";
import { inferType } from "../util";
import { BasePlugin, Notification, PluginHost } from "./plugin";

const graphRecordSymbol = Symbol("graphRecord");

export interface GraphRecord {
    depth: number;
    inner: boolean;
    inners: Subscription[];
    innersFlushed: number;
    link: GraphRecord;
    rootSink: Subscription | undefined;
    self: Subscription;
    sentinel: GraphRecord;
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
    private sentinel_: GraphRecord;

    constructor({
        keptDuration = 30000,
        pluginHost
    }: {
        keptDuration?: number,
        pluginHost: PluginHost
    }) {

        super("graph");

        this.flushIntervalId_ = undefined;
        this.flushQueue_ = [];
        this.keptDuration_ = keptDuration;
        this.notifications_ = [];
        this.sentinel_ = {
            depth: 0,
            inner: false,
            inners: [],
            innersFlushed: 0,
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

    afterPipe(operators: OperatorFunction<any, any>[], source: Observable<any>, sink: Observable<any>): void {
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

    beforePipe(operators: OperatorFunction<any, any>[], source: Observable<any>): void {
    }

    beforeSubscribe(subscription: Subscription): void {

        const { notifications_, sentinel_ } = this;
        const graphRecord = this.setGraphRecord_(subscription, {
            depth: 1,
            inner: false,
            inners: [],
            innersFlushed: 0,
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
            const sourceGraphRecord = this.getGraphRecord(source);
            const { sink } = sourceGraphRecord;
            if (sink) {
                const sinkGraphRecord = this.getGraphRecord(sink);
                sinkGraphRecord.inners.push(subscription);
                graphRecord.link = sinkGraphRecord;
                graphRecord.inner = true;
                graphRecord.rootSink = sinkGraphRecord.rootSink || sink;
                graphRecord.sink = sink;
            }
        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const { subscription: sink } = notifications_[length - 1];
                    const sinkGraphRecord = this.getGraphRecord(sink);
                    sinkGraphRecord.sources.push(subscription);
                    graphRecord.depth = sinkGraphRecord.depth + 1;
                    graphRecord.link = sinkGraphRecord;
                    graphRecord.rootSink = sinkGraphRecord.rootSink || sink;
                    graphRecord.sink = sink;

                    break;
                }
            }
        }

        if (graphRecord.link === graphRecord.sentinel) {
            graphRecord.sentinel.sources.push(subscription);
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

    getGraphRecord(subscription: Subscription): GraphRecord {

        return subscription[graphRecordSymbol];
    }

    logGraph(subscription?: Subscription, logger: Logger = defaultLogger): void {

        const log = (indent: string, source: Subscription, kind: string) => {
            const { observable } = getSubscriptionRecord(source);
            logger.log(`${indent}${inferType(observable)} (${kind})`);
            const graphRecord = this.getGraphRecord(source);
            graphRecord.sources.forEach(source => log(`${indent}  `, source, "source"));
            graphRecord.inners.forEach(inner => log(`${indent}  `, inner, "inner"));
        };

        if (subscription) {
            log("", subscription, "subscription");
        } else {
            const { sentinel_ } = this;
            sentinel_.sources.forEach(source => log("", source, "root"));
        }
    }

    private flush_(subscription: Subscription): void {

        const graphRecord = this.getGraphRecord(subscription);
        const { inners, sources } = graphRecord;

        if (
            (getSubscriptionRecord(subscription).unsubscribeTimestamp === 0) ||
            inners.some(inner => getSubscriptionRecord(inner).unsubscribeTimestamp === 0) ||
            sources.some(source => getSubscriptionRecord(source).unsubscribeTimestamp === 0)
        ) {
            return;
        }

        const { keptDuration_ } = this;
        const { link } = graphRecord;

        const flush = () => {
            const { inners, sources } = link;
            const innerIndex = inners.indexOf(subscription);
            if (innerIndex !== -1) {
                inners.splice(innerIndex, 1);
                ++link.innersFlushed;
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
        graphRecord: GraphRecord,
        match: Match
    ): Subscription | undefined {

        const { inners, self, sources } = graphRecord;

        const iter = (
            found: Subscription | undefined,
            subscription: Subscription
        ) => {
            if (found) {
                return found;
            }
            return this.findSubscription_(
                this.getGraphRecord(subscription),
                match
            );
        };

        if (self && matches(self, match)) {
            return self;
        }
        return sources.reduce(iter, undefined) || inners.reduce(iter, undefined);
    }

    private setGraphRecord_(subscription: Subscription, record: GraphRecord): GraphRecord {

        subscription[graphRecordSymbol] = record;
        return record;
    }
}
