/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { BasePlugin, Notification, SubscriptionRef } from "./plugin";

const graphRefSymbol = Symbol("graphRef");

export interface GraphRef {
    destination: SubscriptionRef | null;
    merges: SubscriptionRef[];
    rootDestination: SubscriptionRef | null;
    sources: SubscriptionRef[];
}

export function getGraphRef(ref: SubscriptionRef): GraphRef {

    return ref[graphRefSymbol];
}

function setGraphRef(ref: SubscriptionRef, value: GraphRef): GraphRef {

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

        const graphRef = setGraphRef(ref, {
            destination: null,
            merges: [],
            rootDestination: null,
            sources: []
        });

        const { notifications_ } = this;
        const length = notifications_.length;

        if ((length > 0) && (notifications_[length - 1].notification === "next")) {

            const { ref: destinationRef } = notifications_[length - 1];
            const destinationGraphRef = getGraphRef(destinationRef);
            destinationGraphRef.merges.push(ref);
            graphRef.destination = destinationRef;
            graphRef.rootDestination = destinationGraphRef.rootDestination || destinationRef;

        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const { ref: destinationRef } = notifications_[length - 1];
                    const destinationGraphRef = getGraphRef(destinationRef);
                    destinationGraphRef.sources.push(ref);
                    graphRef.destination = destinationRef;
                    graphRef.rootDestination = destinationGraphRef.rootDestination || destinationRef;

                    break;
                }
            }
        }

        notifications_.push({ notification: "subscribe", ref });
    }
}
