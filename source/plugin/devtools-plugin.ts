/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { stringify } from "circular-json";
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import { fromPromise } from "rxjs/observable/fromPromise";
import { filter } from "rxjs/operator/filter";
import { map } from "rxjs/operator/map";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";

import {
    BATCH_MILLISECONDS,
    BATCH_NOTIFICATIONS,
    EXTENSION_KEY,
    MESSAGE_BATCH,
    MESSAGE_BROADCAST,
    MESSAGE_RESPONSE
} from "../devtools/constants";

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
import { hide } from "../operator/hide";
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
    private posts_!: Observable<Post>;
    private plugins_: Map<string, PluginRecord>;
    private responses_!: Observable<Response>;
    private snapshotHinted_: boolean;
    private spy_: Spy;
    private subscription_!: Subscription;

    constructor(spy: Spy) {

        super("devTools");

        this.batchQueue_ = [];
        this.plugins_ = new Map<string, PluginRecord>();
        this.snapshotHinted_ = false;
        this.spy_ = spy;

        if ((typeof window !== "undefined") && window[EXTENSION_KEY]) {

            const extension = window[EXTENSION_KEY] as Extension;
            this.connection_ = extension.connect({ version: spy.version });

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
                    this.recordPlugin_(request["spyId"], request.postId, new LogPlugin(this.spy_, request["spyId"]));
                    response["pluginId"] = request.postId;
                    break;
                case "log-teardown":
                    this.teardownPlugin_(request["pluginId"]);
                    break;
                case "pause":
                    const plugin = new PausePlugin(request["spyId"]);
                    this.recordPlugin_(request["spyId"], request.postId, plugin);
                    hide.call(plugin.deck.stats).subscribe((stats: DeckStats) => {
                        this.batchDeckStats_(toStats(request["spyId"], stats));
                    });
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
                    this.snapshotHinted_ = false;
                    const snapshotPlugin = this.spy_.find(SnapshotPlugin);
                    if (snapshotPlugin) {
                        const snapshot = snapshotPlugin.snapshotAll();
                        response["snapshot"] = toSnapshot(snapshot);
                        return response;
                    }
                    response.error = "Cannot find snapshot plugin.";
                    break;
                default:
                    response.error = "Unexpected request.";
                    break;
                }
                return response;
            });

            this.subscription_ = hide.call(this.responses_).subscribe((response: Response) => {
                if (this.connection_) {
                    this.connection_.post(response);
                }
            });
        }
    }

    afterSubscribe(ref: SubscriptionRef): void {

        this.batchNotification_({
            notification: "subscribe",
            prefix: "after",
            ref
        });
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        this.batchNotification_({
            notification: "unsubscribe",
            prefix: "after",
            ref
        });
    }

    beforeComplete(ref: SubscriptionRef): void {

        this.batchNotification_({
            notification: "complete",
            prefix: "before",
            ref
        });
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        this.batchNotification_({
            error,
            notification: "error",
            prefix: "before",
            ref
        });
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        this.batchNotification_({
            notification: "next",
            prefix: "before",
            ref,
            value
        });
    }

    beforeSubscribe(ref: SubscriberRef): void {

        this.batchNotification_({
            notification: "subscribe",
            prefix: "before",
            ref
        });
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        this.batchNotification_({
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

    private batchDeckStats_(stats: DeckStatsPayload): void {

        this.batchQueue_ = this.batchQueue_.filter(message =>
            (message.broadcastType !== "deck-stats") ||
            (message.stats.id !== stats.id)
        );

        this.batchMessage_({
            broadcastType: "deck-stats",
            messageType: MESSAGE_BROADCAST,
            stats
        });
    }

    private batchMessage_(message: Message): void {

        // If there are numerous, high-frequency observables, the connection
        // can become overloaded. Post the messages in batches, at a sensible
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

    private batchNotification_(notificationRef: NotificationRef): void {

        const { connection_ } = this;
        if (connection_) {

            if (this.snapshotHinted_) {
                return;
            }

            const count = this.batchQueue_.reduce((c, message) => (message.broadcastType === "notification") ? c + 1 : c, 0);
            if (count > BATCH_NOTIFICATIONS) {
                this.batchQueue_ = this.batchQueue_.filter(message => message.broadcastType !== "notification");
                this.batchMessage_({
                    broadcastType: "snapshot-hint",
                    messageType: MESSAGE_BROADCAST
                });
                this.snapshotHinted_ = true;
            } else {
                this.batchMessage_({
                    broadcastType: "notification",
                    messageType: MESSAGE_BROADCAST,
                    notification: this.toNotification_(notificationRef)
                });
            }
        }
    }

    private recordPlugin_(spyId: string, pluginId: string, plugin: Plugin): void {

        const teardown = this.spy_.plug(plugin);
        this.plugins_.set(pluginId, { plugin, pluginId, spyId, teardown });
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
                stackTrace: s.stackTrace as any,
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
