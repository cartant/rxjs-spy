/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { getGraphRef } from "./graph-plugin";
import { read } from "../match";
import { BasePlugin, Notification, SubscriberRef, SubscriptionRef } from "./plugin";
import { getStackTrace } from "./stack-trace-plugin";

interface MessageRef {
    error?: any;
    notification: Notification;
    prefix: "after" | "before";
    ref: SubscriberRef;
    value?: any;
}

export class DevToolsPlugin extends BasePlugin {

    afterSubscribe(ref: SubscriptionRef): void {

        postMessage({
            notification: "subscribe",
            prefix: "after",
            ref
        });
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        postMessage({
            notification: "unsubscribe",
            prefix: "after",
            ref
        });
    }

    beforeComplete(ref: SubscriptionRef): void {

        postMessage({
            notification: "complete",
            prefix: "before",
            ref
        });
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        postMessage({
            error,
            notification: "error",
            prefix: "before",
            ref
        });
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        postMessage({
            notification: "next",
            prefix: "before",
            ref,
            value
        });
    }

    beforeSubscribe(ref: SubscriberRef): void {

        postMessage({
            notification: "subscribe",
            prefix: "before",
            ref
        });
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        postMessage({
            notification: "unsubscribe",
            prefix: "before",
            ref
        });
    }
}

function postMessage(messageRef: MessageRef): void {

    if ((typeof window !== "undefined") && (typeof window.postMessage === "function")) {
        window.postMessage({
            message: toMessage(messageRef),
            source: "rxjs-spy"
        }, "*");
    }
}

function toGraph(subscriberRef: SubscriberRef): any {

    const graphRef = getGraphRef(subscriberRef);

    if (!graphRef) {
        return null;
    }

    const { destination, merges, rootDestination, sources } = graphRef;
    return {
        destination: destination ? destination.id : null,
        merges: merges.map((m) => m.id),
        rootDestination: rootDestination ? rootDestination.id : null,
        sources: merges.map((s) => s.id)
    };
}

function toMessage(messageRef: MessageRef): any {

    const { error, notification, prefix, ref, value } = messageRef;
    const { id, observable } = ref;

    return {
        error,
        graph: toGraph(ref),
        id,
        notification: `${prefix}-${notification}`,
        stackTrace: getStackTrace(ref) || null,
        tag: read(observable) || null,
        type: toType(observable),
        value
    };
}

function toType(observable: Observable<any>): string {

    const prototype = Object.getPrototypeOf(observable);
    if (prototype.constructor && prototype.constructor.name) {
        return prototype.constructor.name;
    }
    return "Object";
}
