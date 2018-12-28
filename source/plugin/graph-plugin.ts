/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Subscription } from "rxjs";
import { defaultLogger, Logger } from "../logger";
import { Match, matches } from "../match";
import { Spy } from "../spy-interface";
import { getSubscriptionRef, SubscriptionRef } from "../subscription-ref";
import { inferType } from "../util";
import { BasePlugin, Notification } from "./plugin";

const graphRefSymbol = Symbol("graphRef");

export interface GraphRef {
    depth: number;
    flats: SubscriptionRef[];
    flatsFlushed: number;
    flattened: boolean;
    link: GraphRef;
    rootSink: SubscriptionRef | undefined;
    self: SubscriptionRef;
    sentinel: GraphRef;
    sink: SubscriptionRef | undefined;
    sources: SubscriptionRef[];
    sourcesFlushed: number;
}

export function getGraphRef(ref: SubscriptionRef): GraphRef {

    return ref[graphRefSymbol];
}

export function logGraph(ref: SubscriptionRef, {
    all = false,
    logger = defaultLogger
}: {
    all?: boolean,
    logger?: Logger
}): void {

    if (all) {
        const { sentinel } = getGraphRef(ref);
        sentinel.sources.forEach(source => log("", source, "root"));
    } else {
        log("", ref, "ref");
    }

    function log(indent: string, source: SubscriptionRef, kind: string): void {
        logger.log(`${indent}${inferType(source.observable)} (${kind})`);
        const graphRef = getGraphRef(source);
        graphRef.sources.forEach(source => log(`${indent}  `, source, "source"));
        graphRef.flats.forEach(flat => log(`${indent}  `, flat, "flat"));
    }
}

function setGraphRef(ref: SubscriptionRef, value: GraphRef): GraphRef {

    ref[graphRefSymbol] = value;
    return value;
}

export class GraphPlugin extends BasePlugin {

    private flushIntervalId_: any;
    private flushQueue_: { due: number, flush: Function }[];
    private keptDuration_: number;
    private notifications_: {
        notification: Notification;
        subscriptionRef: SubscriptionRef;
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
        const subscriptionRef = getSubscriptionRef(subscription);
        this.flush_(subscriptionRef);
    }

    beforeNext(subscription: Subscription, value: any): void {

        const { notifications_ } = this;
        const subscriptionRef = getSubscriptionRef(subscription);
        notifications_.push({ notification: "next", subscriptionRef });
    }

    beforeSubscribe(subscription: Subscription): void {

        const { notifications_, sentinel_ } = this;
        const subscriptionRef = getSubscriptionRef(subscription);
        const graphRef = setGraphRef(subscriptionRef, {
            depth: 1,
            flats: [],
            flatsFlushed: 0,
            flattened: false,
            link: sentinel_,
            rootSink: undefined,
            self: subscriptionRef,
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

            const { subscriptionRef: sourceRef } = notifications_[length - 1];
            const sourceGraphRef = getGraphRef(sourceRef);
            const sinkRef = sourceGraphRef.sink;
            if (sinkRef) {
                const sinkGraphRef = getGraphRef(sinkRef);
                sinkGraphRef.flats.push(subscriptionRef as SubscriptionRef);
                graphRef.link = sinkGraphRef;
                graphRef.flattened = true;
                graphRef.rootSink = sinkGraphRef.rootSink || sinkRef as SubscriptionRef;
                graphRef.sink = sinkRef as SubscriptionRef;
            }
        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const { subscriptionRef: sinkRef } = notifications_[length - 1];
                    const sinkGraphRef = getGraphRef(sinkRef);
                    sinkGraphRef.sources.push(subscriptionRef as SubscriptionRef);
                    graphRef.depth = sinkGraphRef.depth + 1;
                    graphRef.link = sinkGraphRef;
                    graphRef.rootSink = sinkGraphRef.rootSink || sinkRef as SubscriptionRef;
                    graphRef.sink = sinkRef as SubscriptionRef;

                    break;
                }
            }
        }

        if (graphRef.link === graphRef.sentinel) {
            graphRef.sentinel.sources.push(subscriptionRef);
        }

        notifications_.push({ notification: "subscribe", subscriptionRef });
    }

    beforeUnsubscribe(subscription: Subscription): void {

        const { notifications_ } = this;
        const subscriptionRef = getSubscriptionRef(subscription);
        notifications_.push({ notification: "unsubscribe", subscriptionRef });
    }

    findRootSubscriptionRefs(): SubscriptionRef[] {

        const { sentinel_ } = this;
        return sentinel_ ? sentinel_.sources : [];
    }

    findSubscriptionRef(match: Match): SubscriptionRef | undefined {

        const { sentinel_ } = this;
        return findSubscriptionRef(sentinel_, match);
    }

    teardown(): void {

        if (this.flushIntervalId_ !== undefined) {
            clearInterval(this.flushIntervalId_);
            this.flushIntervalId_ = undefined;
        }
    }

    private flush_(ref: SubscriptionRef): void {

        const graphRef = getGraphRef(ref);
        const { flats, sources } = graphRef;

        if (
            (ref.unsubscribeTimestamp === 0) ||
            flats.some(ref => ref.unsubscribeTimestamp === 0) ||
            sources.some(ref => ref.unsubscribeTimestamp === 0)
        ) {
            return;
        }

        const { keptDuration_ } = this;
        const { link } = graphRef;

        const flush = () => {
            const { flats, sources } = link;
            const flatIndex = flats.indexOf(ref);
            if (flatIndex !== -1) {
                flats.splice(flatIndex, 1);
                ++link.flatsFlushed;
            }
            const sourceIndex = sources.indexOf(ref);
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
}

function findSubscriptionRef(
    graphRef: GraphRef,
    match: Match
): SubscriptionRef | undefined {

    const { flats, self, sources } = graphRef;
    if (self && matches(self, match)) {
        return self;
    }

    function iter(
        found: SubscriptionRef | undefined,
        subscriptionRef: SubscriptionRef
    ): SubscriptionRef | undefined {
        if (found) {
            return found;
        }
        return findSubscriptionRef(
            getGraphRef(subscriptionRef),
            match
        );
    }
    return sources.reduce(iter, undefined) || flats.reduce(iter, undefined);
}
