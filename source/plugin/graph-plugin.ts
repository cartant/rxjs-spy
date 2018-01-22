/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { BasePlugin, Notification } from "./plugin";
import { SubscriberRef, SubscriptionRef } from "../subscription-ref";

const graphRefSymbol = Symbol("graphRef");

export interface GraphRef {
    depth: number;
    flattened: boolean;
    flattenings: SubscriptionRef[];
    flatteningsFlushed: number;
    link: GraphRef;
    rootSink: SubscriptionRef | undefined;
    sentinel: GraphRef;
    sink: SubscriptionRef | undefined;
    sources: SubscriptionRef[];
    sourcesFlushed: number;
}

export function getGraphRef(ref: SubscriberRef): GraphRef {

    return ref[graphRefSymbol];
}

function setGraphRef(ref: SubscriberRef, value: GraphRef): GraphRef {

    ref[graphRefSymbol] = value;
    return value;
}

export class GraphPlugin extends BasePlugin {

    private flushIntervalId_: any;
    private flushQueue_: { due: number, flush: Function }[];
    private keptDuration_: number;
    private notifications_: {
        notification: Notification;
        ref: SubscriberRef;
    }[];
    private sentinel_: GraphRef;

    constructor({
        keptDuration = 30000
    }: {
        keptDuration?: number
    } = {}) {

        super("graph");

        this.flushIntervalId_ = undefined;
        this.flushQueue_ = [];
        this.keptDuration_ = keptDuration;
        this.notifications_ = [];
        this.sentinel_ = {
            depth: 0,
            flattened: false,
            flattenings: [],
            flatteningsFlushed: 0,
            link: undefined!,
            rootSink: undefined,
            sentinel: undefined!,
            sink: undefined,
            sources: [],
            sourcesFlushed: 0
        };
        this.sentinel_.link = this.sentinel_;
        this.sentinel_.sentinel = this.sentinel_;
    }

    afterNext(ref: SubscriptionRef, value: any): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    afterSubscribe(ref: SubscriptionRef): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        const { notifications_, sentinel_ } = this;
        notifications_.pop();

        const length = notifications_.length;
        if ((length === 0) || (notifications_[length - 1].notification !== "unsubscribe")) {
            this.flush_(ref);
        }
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { notifications_ } = this;
        notifications_.push({ notification: "next", ref });
    }

    beforeSubscribe(ref: SubscriberRef): void {

        const { notifications_, sentinel_ } = this;

        const graphRef = setGraphRef(ref, {
            depth: 1,
            flattened: false,
            flattenings: [],
            flatteningsFlushed: 0,
            link: sentinel_,
            rootSink: undefined,
            sentinel: sentinel_,
            sink: undefined,
            sources: [],
            sourcesFlushed: 0
        });

        const length = notifications_.length;
        if ((length > 0) && (notifications_[length - 1].notification === "next")) {

            const { ref: sinkRef } = notifications_[length - 1];
            const sinkGraphRef = getGraphRef(sinkRef);
            sinkGraphRef.flattenings.push(ref as SubscriptionRef);
            graphRef.link = sinkGraphRef;
            graphRef.flattened = true;
            graphRef.rootSink = sinkGraphRef.rootSink || sinkRef as SubscriptionRef;
            graphRef.sink = sinkRef as SubscriptionRef;

        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const { ref: sinkRef } = notifications_[length - 1];
                    const sinkGraphRef = getGraphRef(sinkRef);
                    sinkGraphRef.sources.push(ref as SubscriptionRef);
                    graphRef.depth = sinkGraphRef.depth + 1;
                    graphRef.link = sinkGraphRef;
                    graphRef.rootSink = sinkGraphRef.rootSink || sinkRef as SubscriptionRef;
                    graphRef.sink = sinkRef as SubscriptionRef;

                    break;
                }
            }
        }

        if (graphRef.link === graphRef.sentinel) {
            graphRef.sentinel.sources.push(ref as SubscriptionRef);
        }

        notifications_.push({ notification: "subscribe", ref });
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        const { notifications_ } = this;
        notifications_.push({ notification: "unsubscribe", ref });
    }

    teardown(): void {

        if (this.flushIntervalId_ !== undefined) {
            clearInterval(this.flushIntervalId_);
            this.flushIntervalId_ = undefined;
        }
    }

    private flush_(ref: SubscriptionRef): void {

        const graphRef = getGraphRef(ref);
        const { flattenings, sources } = graphRef;

        if (!ref.unsubscribed || !flattenings.every(ref => ref.unsubscribed) || !sources.every(ref => ref.unsubscribed)) {
            return;
        }

        const { keptDuration_ } = this;
        const { link, sink } = graphRef;

        const flush = () => {
            const { flattenings, sources } = link;
            const flatteningIndex = flattenings.indexOf(ref);
            if (flatteningIndex !== -1) {
                flattenings.splice(flatteningIndex, 1);
                ++link.flatteningsFlushed;
            }
            const sourceIndex = sources.indexOf(ref);
            if (sourceIndex !== -1) {
                sources.splice(sourceIndex, 1);
                ++link.sourcesFlushed;
            }
            if (sink && sink.unsubscribed) {
                this.flush_(sink);
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
