/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { BasePlugin, Notification, SubscriberRef, SubscriptionRef } from "./plugin";

const graphRefSymbol = Symbol("graphRef");

export interface GraphRef {
    destination: SubscriptionRef | null;
    link: GraphRef;
    merges: SubscriptionRef[];
    mergesFlushed: number;
    rootDestination: SubscriptionRef | null;
    sentinel: GraphRef;
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

        super();

        this.keptDuration_ = keptDuration;
        this.notifications_ = [];
        this.sentinel_ = {
            destination: null,
            link: null!,
            merges: [],
            mergesFlushed: 0,
            rootDestination: null,
            sentinel: null!,
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
            destination: null,
            link: sentinel_,
            merges: [],
            mergesFlushed: 0,
            rootDestination: null,
            sentinel: sentinel_,
            sources: [],
            sourcesFlushed: 0
        });

        const length = notifications_.length;
        if ((length > 0) && (notifications_[length - 1].notification === "next")) {

            const { ref: destinationRef } = notifications_[length - 1];
            const destinationGraphRef = getGraphRef(destinationRef);
            destinationGraphRef.merges.push(ref as SubscriptionRef);
            graphRef.destination = destinationRef as SubscriptionRef;
            graphRef.link = destinationGraphRef;
            graphRef.rootDestination = destinationGraphRef.rootDestination || destinationRef as SubscriptionRef;

        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const { ref: destinationRef } = notifications_[length - 1];
                    const destinationGraphRef = getGraphRef(destinationRef);
                    destinationGraphRef.sources.push(ref as SubscriptionRef);
                    graphRef.destination = destinationRef as SubscriptionRef;
                    graphRef.link = destinationGraphRef;
                    graphRef.rootDestination = destinationGraphRef.rootDestination || destinationRef as SubscriptionRef;

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

    private flush_(ref: SubscriptionRef): void {

        const graphRef = getGraphRef(ref);
        const { merges, sources } = graphRef;

        if (!ref.unsubscribed || !merges.every(ref => ref.unsubscribed) || !sources.every(ref => ref.unsubscribed)) {
            return;
        }

        const { sentinel_ } = this;
        const { destination, link } = graphRef;
        const { keptDuration_ } = this;

        const flush = () => {
            const { merges, sources } = link;
            const mergeIndex = merges.indexOf(ref);
            if (mergeIndex !== -1) {
                merges.splice(mergeIndex, 1);
                ++link.mergesFlushed;
            }
            const sourceIndex = sources.indexOf(ref);
            if (sourceIndex !== -1) {
                sources.splice(sourceIndex, 1);
                ++link.sourcesFlushed;
            }
            if (destination && destination.unsubscribed) {
                this.flush_(destination);
            }
        };

        if (keptDuration_ === 0) {
            flush();
        } else if ((keptDuration_ > 0) && (keptDuration_ < Infinity)) {
            setTimeout(flush, keptDuration_);
        }
    }
}
