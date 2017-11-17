/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { stringify } from "circular-json";
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { EXTENSION_KEY, MESSAGE_NOTIFICATION, MESSAGE_RESPONSE } from "../devtools/constants";
import { isPostRequest } from "../devtools/guards";

import {
    Connection,
    Extension,
    Graph as GraphPayload,
    Message,
    Notification as NotificationMessage,
    Post,
    Request,
    Response,
    Snapshot as SnapshotPayload
} from "../devtools/interfaces";

import { getGraphRef } from "./graph-plugin";
import { identify } from "../identify";
import { read } from "../match";
import { BasePlugin, Notification, Plugin, SubscriberRef, SubscriptionRef } from "./plugin";
import { Snapshot, SnapshotPlugin } from "./snapshot-plugin";
import { getStackTrace, getStackTraceRef } from "./stack-trace-plugin";
import { tick } from "../tick";

import "rxjs/add/observable/of";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/share";
import "rxjs/add/operator/switchMap";

interface MessageRef {
    error?: any;
    notification: Notification;
    prefix: "after" | "before";
    ref: SubscriberRef;
    value?: any;
}

export class DevToolsPlugin extends BasePlugin {

    private connection_: Connection | null;
    private posts_: Observable<Post>;
    private responses_: Observable<Response>;
    private subscription_: Subscription;

    constructor(
        find: <T extends Plugin>(constructor: { new (...args: any[]): T }) => T | null,
        plugin: (plugin: Plugin, name: string) => () => void
    ) {

        super();

        if ((typeof window !== "undefined") && window[EXTENSION_KEY]) {
            const extension = window[EXTENSION_KEY] as Extension;
            this.connection_ = extension.connect();
            this.posts_ = Observable.create((observer: Observer<Post>) => this.connection_ ?
                this.connection_.subscribe((post) => observer.next(post)) :
                () => {}
            ).share();
            this.responses_ = this.posts_
                .filter(isPostRequest)
                .switchMap((request) => {
                    const response: Response = {
                        messageType: MESSAGE_RESPONSE,
                        request
                    };
                    switch (request.requestType) {
                    case "snapshot":
                        const snapshotPlugin = find(SnapshotPlugin);
                        if (snapshotPlugin) {
                            const snapshot = snapshotPlugin.snapshotAll();
                            response["snapshot"] = toSnapshot(snapshot);
                            return snapshot.sourceMapsResolved.then(() => response);
                        }
                        response.error = "Cannot find snapshot plugin.";
                        break;
                    default:
                        response.error = "Unexpected request.";
                        break;
                    }
                    return Observable.of(response);
                })
                .share();
            this.subscription_ = this.responses_.subscribe((response) => {
                console.log(JSON.stringify(response, null, 2));
                if (this.connection_) {
                    this.connection_.post(response);
                }
            });
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
            this.subscription_.unsubscribe();
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

function toGraph(subscriberRef: SubscriberRef): GraphPayload | null {

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
        messageType: MESSAGE_NOTIFICATION,
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

function toSnapshot(snapshot: Snapshot): SnapshotPayload {

    return {
        observables: Array
            .from(snapshot.observables.values())
            .map((s) => ({
                id: s.id,
                subscriptions: Array
                    .from(s.subscriptions.values())
                    .map(s => s.id),
                tag: s.tag,
                tick: s.tick
            })),
        subscribers: Array
            .from(snapshot.subscribers.values())
            .map((s) => ({
                id: s.id,
                subscriptions: Array
                    .from(s.subscriptions.values())
                    .map(s => s.id),
                tick: s.tick,
                values: s.values.map(v => ({
                    tick: v.tick,
                    timestamp: v.timestamp,
                    value: toValue(v.value)
                })),
                valuesFlushed: s.valuesFlushed
            })),
        subscriptions: Array
            .from(snapshot.subscriptions.values())
            .map((s) => ({
                complete: s.complete,
                error: s.error,
                graph: {
                    merges: Array
                        .from(s.merges.values())
                        .map(s => s.id),
                    mergesFlushed: s.mergesFlushed,
                    rootSink: s.rootSink ? s.rootSink.id : null,
                    sink: s.sink ? s.sink.id : null,
                    sources: Array
                        .from(s.sources.values())
                        .map(s => s.id),
                    sourcesFlushed: s.sourcesFlushed
                },
                id: s.id,
                observable: identify(s.observable),
                stackTrace: s.stackTrace,
                subscriber: identify(s.subscriber),
                tick: s.tick,
                timestamp: s.timestamp,
                unsubscribed: s.unsubscribed
            })),
        tick: snapshot.tick
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
