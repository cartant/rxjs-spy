/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { stringify } from "circular-json";
import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { EXTENSION_KEY } from "../devtools/constants";
import { Connection, Extension, Graph, Notification as NotificationMessage } from "../devtools/interfaces";
import { getGraphRef } from "./graph-plugin";
import { identify } from "../identify";
import { read } from "../match";
import { BasePlugin, Notification, SubscriberRef, SubscriptionRef } from "./plugin";
import { getStackTrace, getStackTraceRef } from "./stack-trace-plugin";
import { tick } from "../tick";

interface MessageRef {
    error?: any;
    notification: Notification;
    prefix: "after" | "before";
    ref: SubscriberRef;
    value?: any;
}

export class DevToolsPlugin extends BasePlugin {

    private connection_: Connection | null;

    constructor() {

        super();

        if ((typeof window !== "undefined") && window[EXTENSION_KEY]) {
            const extension = window[EXTENSION_KEY] as Extension;
            this.connection_ = extension.connect();
        }
    }

    afterSubscribe(ref: SubscriptionRef): void {

        this.postMessage_({
            notification: "subscribe",
            prefix: "after",
            ref
        });
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        this.postMessage_({
            notification: "unsubscribe",
            prefix: "after",
            ref
        });
    }

    beforeComplete(ref: SubscriptionRef): void {

        this.postMessage_({
            notification: "complete",
            prefix: "before",
            ref
        });
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        this.postMessage_({
            error,
            notification: "error",
            prefix: "before",
            ref
        });
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        this.postMessage_({
            notification: "next",
            prefix: "before",
            ref,
            value
        });
    }

    beforeSubscribe(ref: SubscriberRef): void {

        this.postMessage_({
            notification: "subscribe",
            prefix: "before",
            ref
        });
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        this.postMessage_({
            notification: "unsubscribe",
            prefix: "before",
            ref
        });
    }

    teardown(): void {

        if (this.connection_) {
            this.connection_.disconnect();
            this.connection_ = null;
        }
    }

    private postMessage_(messageRef: MessageRef): void {

        const { connection_ } = this;
        if (connection_) {

            const post = () => connection_.post(toMessage(messageRef));
            const stackTraceRef = getStackTraceRef(messageRef.ref);

            if (stackTraceRef) {
                stackTraceRef.sourceMapsResolved.then(post);
            } else {
                post();
            }
        }
    }
}

function toGraph(subscriberRef: SubscriberRef): Graph | null {

    const graphRef = getGraphRef(subscriberRef);

    if (!graphRef) {
        return null;
    }

    const {
        merges,
        mergesFlushed,
        rootSink,
        sink,
        sources,
        sourcesFlushed
    } = graphRef;
    return {
        merges: merges.map(identify),
        mergesFlushed,
        rootSink: rootSink ? identify(rootSink) : null,
        sink: sink ? identify(sink) : null,
        sources: merges.map(identify),
        sourcesFlushed
    };
}

function toMessage(messageRef: MessageRef): NotificationMessage {

    const { error, notification, prefix, ref, value } = messageRef;
    const { observable, subscriber } = ref;

    return {
        id: identify({}),
        messageType: "notification",
        notification: `${prefix}-${notification}`,
        observable: {
            id: identify(observable),
            tag: read(observable) || null,
            type: toType(observable)
        },
        subscriber: {
            id: identify(subscriber)
        },
        subscription: {
            error,
            graph: toGraph(ref) || null,
            id: identify(ref),
            stackTrace: getStackTrace(ref) || null
        },
        tick: tick(),
        timestamp: Date.now(),
        value: (value === undefined) ? undefined : toValue(value)
    };
}

function toType(observable: Observable<any>): string {

    const prototype = Object.getPrototypeOf(observable);
    if (prototype.constructor && prototype.constructor.name) {
        return prototype.constructor.name;
    }
    return "Object";
}

function toValue(value: any): { json: string } {

    return { json: stringify(value, null, null, true) };
}
