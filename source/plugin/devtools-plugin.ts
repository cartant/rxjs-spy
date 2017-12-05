/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { stringify } from "circular-json";
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import { filter } from "rxjs/operator/filter";
import { map } from "rxjs/operator/map";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { BATCH_MILLISECONDS, EXTENSION_KEY, MESSAGE_BATCH, MESSAGE_BROADCAST, MESSAGE_RESPONSE } from "../devtools/constants";
import { isPostRequest } from "../devtools/guards";

import {
    Batch,
    Broadcast,
    Connection,
    DeckStats as DeckStatsPayload,
    Extension,
    Graph as GraphPayload,
    Message,
    Notification as NotificationPayload,
    Post,
    Request,
    Response,
    Snapshot as SnapshotPayload
} from "../devtools/interfaces";

import { getGraphRef } from "./graph-plugin";
import { identify } from "../identify";
import { LogPlugin } from "./log-plugin";
import { read } from "../match";
import { Deck, DeckStats, PausePlugin } from "./pause-plugin";
import { BasePlugin, Notification, Plugin } from "./plugin";
import { Snapshot, SnapshotPlugin } from "./snapshot-plugin";
import { Spy } from "../spy-interface";
import { getStackTrace, getStackTraceRef } from "./stack-trace-plugin";
import { SubscriberRef, SubscriptionRef } from "../subscription-ref";
import { inferPath, inferType } from "../util";

interface NotificationRef {
    error?: any;
    notification: Notification;
    prefix: "after" | "before";
    ref: SubscriberRef;
    value?: any;
}

interface PluginRecord {
    plugin: Plugin;
    pluginId: string;
    spyId: string;
    teardown: () => void;
}

export class DevToolsPlugin extends BasePlugin {

    private batchQueue_: Message[];
    private batchTimeoutId_: any;
    private connection_: Connection | undefined;
    private posts_: Observable<Post>;
    private plugins_: Map<string, PluginRecord>;
    private resolveQueue_: { notification: NotificationPayload, resolved: boolean }[];
    private responses_: Observable<Promise<Response>>;
    private spy_: Spy;
    private subscription_: Subscription;

    constructor(spy: Spy) {

        super("devTools");

        if ((typeof window !== "undefined") && window[EXTENSION_KEY]) {

            const extension = window[EXTENSION_KEY] as Extension;
            this.batchQueue_ = [];
            this.connection_ = extension.connect();
            this.plugins_ = new Map<string, PluginRecord>();
            this.resolveQueue_ = [];
            this.spy_ = spy;

            this.posts_ = Observable.create((observer: Observer<Post>) => this.connection_ ?
                this.connection_.subscribe((post) => observer.next(post)) :
                () => {}
            );

            const filtered = filter.call(this.posts_, isPostRequest);
            this.responses_ = map.call(filtered, (request: Post & Request) => {
                const response: Response = {
                    messageType: MESSAGE_RESPONSE,
                    request
                };
                switch (request.requestType) {
                case "log":
                    this.recordPlugin_(request["spyId"], request.postId, new LogPlugin(request["spyId"]));
                    response["pluginId"] = request.postId;
                    break;
                case "log-teardown":
                    this.teardownPlugin_(request["pluginId"]);
                    break;
                case "pause":
                    const plugin = new PausePlugin(this.spy_, request["spyId"]);
                    this.recordPlugin_(request["spyId"], request.postId, plugin);
                    this.spy_.ignore(() => plugin.deck.stats.subscribe(stats => {
                        this.batchMessage_({
                            broadcastType: "deck-stats",
                            messageType: MESSAGE_BROADCAST,
                            stats: toStats(request["spyId"], stats)
                        });
                    }));
                    response["pluginId"] = request.postId;
                    break;
                case "pause-command":
                    const pluginRecord = this.plugins_.get(request["pluginId"]) as PluginRecord | undefined;
                    if (pluginRecord) {
                        const { deck } = pluginRecord.plugin as PausePlugin;
                        switch (request["command"]) {
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
                            response.error = "Unexpected command.";
                            break;
                        }
                    }
                    break;
                case "pause-teardown":
                    this.teardownPlugin_(request["pluginId"]);
                    break;
                case "snapshot":
                    const snapshotPlugin = this.spy_.find(SnapshotPlugin);
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

            this.subscription_ = this.spy_.ignore(() => this.responses_.subscribe((promise: Promise<Response>) => promise.then(response => {
                if (this.connection_) {
                    this.connection_.post(response);
                }
            })));
        }
    }

    afterSubscribe(ref: SubscriptionRef): void {

        this.resolveNotification_({
            notification: "subscribe",
            prefix: "after",
            ref
        });
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        this.resolveNotification_({
            notification: "unsubscribe",
            prefix: "after",
            ref
        });
    }

    beforeComplete(ref: SubscriptionRef): void {

        this.resolveNotification_({
            notification: "complete",
            prefix: "before",
            ref
        });
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        this.resolveNotification_({
            error,
            notification: "error",
            prefix: "before",
            ref
        });
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        this.resolveNotification_({
            notification: "next",
            prefix: "before",
            ref,
            value
        });
    }

    beforeSubscribe(ref: SubscriberRef): void {

        this.resolveNotification_({
            notification: "subscribe",
            prefix: "before",
            ref
        });
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        this.resolveNotification_({
            notification: "unsubscribe",
            prefix: "before",
            ref
        });
    }

    teardown(): void {

        if (this.batchTimeoutId_ !== undefined) {
            clearTimeout(this.batchTimeoutId_);
            this.batchTimeoutId_ = undefined;
        }
        if (this.connection_) {
            this.connection_.disconnect();
            this.connection_ = undefined;
            this.subscription_.unsubscribe();
        }
    }

    private batchMessage_(message: Message): void {

        // If there are numerous, high-frequency observables, the connection
        // can become overloaded. Post the message in batches, at a sensible
        // interval.

        if (this.batchTimeoutId_ !== undefined) {
            this.batchQueue_.push(message);
        } else {
            this.batchQueue_ = [message];
            this.batchTimeoutId_ = setTimeout(() => {

                const { connection_ } = this;
                if (connection_) {
                    connection_.post({
                        messageType: MESSAGE_BATCH,
                        messages: this.batchQueue_
                    });
                    this.batchTimeoutId_ = undefined;
                    this.batchQueue_ = [];
                }
            }, BATCH_MILLISECONDS);
        }
    }

    private recordPlugin_(spyId: string, pluginId: string, plugin: Plugin): void {

        const teardown = this.spy_.plug(plugin);
        this.plugins_.set(pluginId, { plugin, pluginId, spyId, teardown });
    }

    private resolveNotification_(notificationRef: NotificationRef): void {

        const { connection_, resolveQueue_ } = this;
        if (connection_) {

            const notification = this.toNotification_(notificationRef);
            const stackTraceRef = getStackTraceRef(notificationRef.ref);

            // If source maps are enabled queue notifications until their source
            // maps are resolved and ensure they are batched/broadcast in order
            // of emission and not order of source map resolution.

            if (stackTraceRef) {
                const queued = { notification, resolved: false };
                resolveQueue_.push(queued);
                stackTraceRef.sourceMapsResolved.then(() => {
                    queued.resolved = true;
                    while (resolveQueue_.length && resolveQueue_[0].resolved) {
                        this.batchMessage_({
                            broadcastType: "notification",
                            messageType: MESSAGE_BROADCAST,
                            notification: resolveQueue_.shift()!.notification
                        });
                    }
                });
            } else {
                this.batchMessage_({
                    broadcastType: "notification",
                    messageType: MESSAGE_BROADCAST,
                    notification
                });
            }
        }
    }

    private teardownPlugin_(pluginId: string): void {

        const { plugins_ } = this;
        const record = plugins_.get(pluginId);
        if (record) {
            record.teardown();
            plugins_.delete(pluginId);
        }
    }

    private toNotification_(notificationRef: NotificationRef): NotificationPayload {

        const { error, notification, prefix, ref, value } = notificationRef;
        const { observable, subscriber } = ref;

        return {
            id: identify({}),
            observable: {
                id: identify(observable),
                path: inferPath(observable),
                tag: orNull(read(observable)),
                type: inferType(observable)
            },
            subscriber: {
                id: identify(subscriber)
            },
            subscription: {
                error,
                graph: orNull(toGraph(ref)),
                id: identify(ref),
                stackTrace: orNull(getStackTrace(ref))
            },
            tick: this.spy_.tick,
            timestamp: Date.now(),
            type: `${prefix}-${notification}`,
            value: (value === undefined) ? undefined : toValue(value)
        };
    }
}

function orNull(value: any): any {

    return  (value === undefined) ? null : value;
}

function toGraph(subscriberRef: SubscriberRef): GraphPayload | undefined {

    const graphRef = getGraphRef(subscriberRef);

    if (!graphRef) {
        return undefined;
    }

    const {
        flattenings,
        flatteningsFlushed,
        rootSink,
        sink,
        sources,
        sourcesFlushed
    } = graphRef;
    return {
        flattenings: flattenings.map(identify),
        flatteningsFlushed,
        rootSink: rootSink ? identify(rootSink) : null,
        sink: sink ? identify(sink) : null,
        sources: sources.map(identify),
        sourcesFlushed
    };
}

function toSnapshot(snapshot: Snapshot): SnapshotPayload {

    return {
        observables: Array
            .from(snapshot.observables.values())
            .map((s) => ({
                id: s.id,
                path: s.path,
                subscriptions: Array
                    .from(s.subscriptions.values())
                    .map(s => s.id),
                tag: orNull(s.tag),
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
                    flattenings: Array
                        .from(s.flattenings.values())
                        .map(s => s.id),
                    flatteningsFlushed: s.flatteningsFlushed,
                    rootSink: s.rootSink ? identify(s.rootSink) : null,
                    sink: s.sink ? identify(s.sink) : null,
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

function toStats(id: string, stats: DeckStats): DeckStatsPayload {

    return { id, ...stats };
}

function toValue(value: any): { json: string } {

    return { json: stringify(value, null, null, true) };
}
