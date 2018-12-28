/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { stringify } from "circular-json";
import { Observable, Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";

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

import { identify } from "../identify";
import { read } from "../match";
import { hide } from "../operators";
import { Spy } from "../spy-interface";
import { getSubscriptionLabel, SubscriptionLabel } from "../subscription-label";
import { inferPath, inferType } from "../util";
import { GraphPlugin } from "./graph-plugin";
import { LogPlugin } from "./log-plugin";
import { DeckStats, PausePlugin } from "./pause-plugin";
import { BasePlugin, Notification, Plugin } from "./plugin";
import { Snapshot, SnapshotPlugin } from "./snapshot-plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

interface NotificationLabel {
    error?: any;
    notification: Notification;
    prefix: "after" | "before";
    subscriptionLabel: SubscriptionLabel;
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
    private foundPlugins_: {
        graphPlugin: GraphPlugin | undefined;
        snapshotPlugin: SnapshotPlugin | undefined;
        stackTracePlugin: StackTracePlugin | undefined;
    } | undefined;
    private posts_!: Observable<Post>;
    private plugins_: Map<string, PluginRecord>;
    private responses_!: Observable<Response>;
    private snapshotHinted_: boolean;
    private spy_: Spy;
    private subscription_!: Subscription;

    constructor({ spy }: { spy: Spy }) {

        super("devTools");

        this.batchQueue_ = [];
        this.foundPlugins_ = undefined;
        this.plugins_ = new Map<string, PluginRecord>();
        this.snapshotHinted_ = false;
        this.spy_ = spy;

        if ((typeof window !== "undefined") && window[EXTENSION_KEY]) {

            const extension = window[EXTENSION_KEY] as Extension;
            this.connection_ = extension.connect({ version: spy.version });

            this.posts_ = new Observable<Post>(observer => this.connection_ ?
                this.connection_.subscribe(post => observer.next(post)) :
                () => {}
            );

            this.responses_ = this.posts_.pipe(
                filter(isPostRequest),
                map((request: Post & Request) => {
                    const response: Response = {
                        messageType: MESSAGE_RESPONSE,
                        request
                    };
                    switch (request.requestType) {
                    case "log": {
                        const plugin = new LogPlugin({
                            observableMatch: request["spyId"],
                            spy: this.spy_
                        });
                        this.recordPlugin_(request["spyId"], request.postId, plugin);
                        response["pluginId"] = request.postId;
                        break;
                    }
                    case "log-teardown":
                        this.teardownPlugin_(request["pluginId"]);
                        break;
                    case "pause": {
                        const plugin = new PausePlugin({
                            match: request["spyId"],
                            spy: this.spy_
                        });
                        this.recordPlugin_(request["spyId"], request.postId, plugin);
                        plugin.deck.stats.pipe(hide()).subscribe((stats: DeckStats) => {
                            this.batchDeckStats_(toStats(request["spyId"], stats));
                        });
                        response["pluginId"] = request.postId;
                        break;
                    }
                    case "pause-command": {
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
                    }
                    case "pause-teardown":
                        this.teardownPlugin_(request["pluginId"]);
                        break;
                    case "snapshot": {
                        this.snapshotHinted_ = false;
                        const { snapshotPlugin } = this.findPlugins_();
                        if (snapshotPlugin) {
                            const snapshot = snapshotPlugin.snapshotAll();
                            response["snapshot"] = toSnapshot(snapshot);
                            return response;
                        }
                        response.error = "Cannot find snapshot plugin.";
                        break;
                    }
                    default:
                        response.error = "Unexpected request.";
                        break;
                    }
                    return response;
                })
            );

            this.subscription_ = this.responses_.pipe(hide()).subscribe((response: Response) => {
                if (this.connection_) {
                    this.connection_.post(response);
                }
            });
        }
    }

    afterSubscribe(subscription: Subscription): void {

        const subscriptionLabel = getSubscriptionLabel(subscription);
        this.batchNotification_({
            notification: "subscribe",
            prefix: "after",
            subscriptionLabel
        });
    }

    afterUnsubscribe(subscription: Subscription): void {

        const subscriptionLabel = getSubscriptionLabel(subscription);
        this.batchNotification_({
            notification: "unsubscribe",
            prefix: "after",
            subscriptionLabel
        });
    }

    beforeComplete(subscription: Subscription): void {

        const subscriptionLabel = getSubscriptionLabel(subscription);
        this.batchNotification_({
            notification: "complete",
            prefix: "before",
            subscriptionLabel
        });
    }

    beforeError(subscription: Subscription, error: any): void {

        const subscriptionLabel = getSubscriptionLabel(subscription);
        this.batchNotification_({
            error,
            notification: "error",
            prefix: "before",
            subscriptionLabel
        });
    }

    beforeNext(subscription: Subscription, value: any): void {

        const subscriptionLabel = getSubscriptionLabel(subscription);
        this.batchNotification_({
            notification: "next",
            prefix: "before",
            subscriptionLabel,
            value
        });
    }

    beforeSubscribe(subscription: Subscription): void {

        const subscriptionLabel = getSubscriptionLabel(subscription);
        this.batchNotification_({
            notification: "subscribe",
            prefix: "before",
            subscriptionLabel
        });
    }

    beforeUnsubscribe(subscription: Subscription): void {

        const subscriptionLabel = getSubscriptionLabel(subscription);
        this.batchNotification_({
            notification: "unsubscribe",
            prefix: "before",
            subscriptionLabel
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

    private batchNotification_(notificationLabel: NotificationLabel): void {

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
                    notification: this.toNotification_(notificationLabel)
                });
            }
        }
    }

    private findPlugins_(): {
        graphPlugin: GraphPlugin | undefined,
        snapshotPlugin: SnapshotPlugin | undefined,
        stackTracePlugin: StackTracePlugin | undefined
    } {

        const { foundPlugins_, spy_ } = this;
        if (foundPlugins_) {
            return foundPlugins_;
        }

        const [graphPlugin] = spy_.find(GraphPlugin);
        const [snapshotPlugin] = spy_.find(SnapshotPlugin);
        const [stackTracePlugin] = spy_.find(StackTracePlugin);

        this.foundPlugins_ = { graphPlugin, snapshotPlugin, stackTracePlugin };
        return this.foundPlugins_;
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

    private toGraph_(subscription: Subscription): GraphPayload | undefined {

        const { graphPlugin } = this.findPlugins_();
        if (!graphPlugin) {
            return undefined;
        }
        const graphLabel = graphPlugin.getGraphLabel(subscription);

        const {
            flats,
            flatsFlushed,
            rootSink,
            sink,
            sources,
            sourcesFlushed
        } = graphLabel;
        return {
            flats: flats.map(identify),
            flatsFlushed,
            rootSink: rootSink ? identify(rootSink) : null,
            sink: sink ? identify(sink) : null,
            sources: sources.map(identify),
            sourcesFlushed
        };
    }

    private toNotification_(notificationLabel: NotificationLabel): NotificationPayload {

        const { stackTracePlugin } = this.findPlugins_();
        const { error, notification, prefix, subscriptionLabel, value } = notificationLabel;
        const { observable, subscriber, subscription } = subscriptionLabel;

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
                graph: orNull(this.toGraph_(subscription)),
                id: identify(subscription),
                stackTrace: orNull(stackTracePlugin && stackTracePlugin.getStackTrace(subscription))
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

function toSnapshot(snapshot: Snapshot): SnapshotPayload {

    return {
        observables: Array
            .from(snapshot.observables.values())
            .map(s => ({
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
            .map(s => ({
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
            .map(s => ({
                completeTimestamp: s.completeTimestamp,
                error: s.error,
                errorTimestamp: s.errorTimestamp,
                graph: {
                    flats: Array
                        .from(s.flats.values())
                        .map(s => s.id),
                    flatsFlushed: s.flatsFlushed,
                    rootSink: s.rootSink ? identify(s.rootSink.subscription) : null,
                    sink: s.sink ? identify(s.sink.subscription) : null,
                    sources: Array
                        .from(s.sources.values())
                        .map(s => s.id),
                    sourcesFlushed: s.sourcesFlushed
                },
                id: s.id,
                nextCount: s.nextCount,
                nextTimestamp: s.nextTimestamp,
                observable: identify(s.observable),
                stackTrace: s.stackTrace as any,
                subscribeTimestamp: s.subscribeTimestamp,
                subscriber: identify(s.subscriber),
                tick: s.tick,
                unsubscribeTimestamp: s.unsubscribeTimestamp,
                values: s.values.map(v => ({
                    tick: v.tick,
                    timestamp: v.timestamp,
                    value: toValue(v.value)
                })),
                valuesFlushed: s.valuesFlushed
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
