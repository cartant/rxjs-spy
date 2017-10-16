/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { BasePlugin, Notification, SubscriptionRef } from "./plugin";

const graphRefSymbol = Symbol("graphRef");

export interface GraphRef {
    destination: SubscriptionRef | null;
    finalDestination: SubscriptionRef | null;
    merges: SubscriptionRef[];
    sources: SubscriptionRef[];
}

export function get(ref: SubscriptionRef): GraphRef {

    return ref[graphRefSymbol];
}

export function set(ref: SubscriptionRef, value: GraphRef): GraphRef {

    ref[graphRefSymbol] = value;
    return value;
}

export class GraphPlugin extends BasePlugin {

    private notifications_: {
        notification: Notification;
        ref: SubscriptionRef;
    }[] = [];

    afterNext(ref: SubscriptionRef, value: any): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    afterSubscribe(ref: SubscriptionRef): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { notifications_ } = this;
        notifications_.push({ notification: "next", ref });
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const graphRef = set(ref, {
            destination: null,
            finalDestination: null,
            merges: [],
            sources: []
        });

        const { notifications_ } = this;
        const length = notifications_.length;

        if ((length > 0) && (notifications_[length - 1].notification === "next")) {

            const { ref: destinationRef } = notifications_[length - 1];
            const destinationGraphRef = get(destinationRef);
            destinationGraphRef.merges.push(ref);
            graphRef.destination = destinationRef;
            graphRef.finalDestination = destinationGraphRef.finalDestination || destinationRef;

        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const { ref: destinationRef } = notifications_[length - 1];
                    const destinationGraphRef = get(destinationRef);
                    destinationGraphRef.sources.push(ref);
                    graphRef.destination = destinationRef;
                    graphRef.finalDestination = destinationGraphRef.finalDestination || destinationRef;

                    break;
                }
            }
        }

        notifications_.push({ notification: "subscribe", ref });
    }
}
