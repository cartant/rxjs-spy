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
import { inferType, SubscriberRef, SubscriptionRef } from "../interfaces";
import { LogPlugin } from "./log-plugin";
import { read, toString as matchToString } from "../match";
import { PausePlugin } from "./pause-plugin";
import { BasePlugin, Notification, Plugin } from "./plugin";
import { Snapshot, SnapshotPlugin } from "./snapshot-plugin";
import { getStackTrace, getStackTraceRef } from "./stack-trace-plugin";
import { tick } from "../tick";

import "rxjs/add/operator/filter";
import "rxjs/add/operator/map";

interface MessageRef {
    error?: any;
    notification: Notification;
    prefix: "after" | "before";
    ref: SubscriberRef;
    value?: any;
}

interface PluginRecord {
    plugin: Plugin;
    teardown: () => void;
}

export class DevToolsPlugin extends BasePlugin {

    private connection_: Connection | null;
    private posts_: Observable<Post>;
    private plugins_: Map<string, PluginRecord>;
    private responses_: Observable<Promise<Response>>;
    private subscription_: Subscription;

    constructor(
        private findPlugin_: <T extends Plugin>(constructor: { new (...args: any[]): T }) => T | null,
        private configurePlugin_: (plugin: Plugin) => () => void,
        private subscribe_: (this: Observable<any>, ...args: any[]) => Subscription
    ) {

        super("devTools");

        if ((typeof window !== "undefined") && window[EXTENSION_KEY]) {

            const extension = window[EXTENSION_KEY] as Extension;
            this.connection_ = extension.connect();
            this.plugins_ = new Map<string, PluginRecord>();

            this.posts_ = Observable.create((observer: Observer<Post>) => this.connection_ ?
                this.connection_.subscribe((post) => observer.next(post)) :
                () => {}
            );

            this.responses_ = this.posts_
                .filter(isPostRequest)
                .map((request) => {
                    const response: Response = {
                        messageType: MESSAGE_RESPONSE,
                        request
                    };
                    switch (request.requestType) {
                    case "log":
                        this.recordPlugin_(request.postId, new LogPlugin(request["match"]));
                        response["pluginId"] = request.postId;
                        break;
                    case "log-teardown":
                        this.teardownPlugin_(request["pluginId"]);
                        break;
                    case "pause":
                        this.recordPlugin_(request.postId, new PausePlugin(request["match"]));
                        response["pluginId"] = request.postId;
                        break;
                    case "pause-deck":
                        const pausePlugin = this.plugins_.get(request["pluginId"]) as PausePlugin | undefined;
                        if (pausePlugin) {
                            const { deck } = pausePlugin;
                            switch (request["deck"]) {
                            case "clear":
                            case "pause":
                            case "resume":
                            case "skip":
                            case "step":
                                deck[request["command"]]();
                                break;
                            case "inspect":
                                response.error = "Not implemented.";
                                break;
                            default:
                                response.error = "Unexpected deck command.";
                                break;
                            }
                        }
                        break;
                    case "pause-teardown":
                        this.teardownPlugin_(request["pluginId"]);
                        break;
                    case "snapshot":
                        const snapshotPlugin = this.findPlugin_(SnapshotPlugin);
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
                    return Promise.resolve(response);
                });

            // The composed observable effects promises and to avoid internal
            // subscriptions that would be seen by the spy, switchMap is not
            // used.

            this.subscription_ = this.subscribe_.call(this.responses_, (promise: Promise<Response>) => promise.then(response => {
                if (this.connection_) {
                    this.connection_.post(response);
                }
            }));
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

    private recordPlugin_(id: string, plugin: Plugin): void {

        const teardown = this.configurePlugin_(plugin);
        this.plugins_.set(id, { plugin, teardown });
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

    private teardownPlugin_(id: string): void {

        const { plugins_ } = this;
        const record = plugins_.get(id);
        if (record) {
            record.teardown();
            plugins_.delete(id);
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
            type: inferType(ref)
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
                tick: s.tick,
                type: s.type
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

function toValue(value: any): { json: string } {

    return { json: stringify(value, null, null, true) };
}
