/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { StackFrame } from "error-stack-parser";
import { forkJoin, Observable, of, Subscriber, Subscription } from "rxjs";
import { mapTo } from "rxjs/operators";
import { identify } from "../identify";
import { read } from "../match";
import { hide } from "../operators";
import { Spy } from "../spy-interface";
import { getSubscriptionLabel } from "../subscription-label";
import { inferPath, inferType } from "../util";
import { GraphPlugin } from "./graph-plugin";
import { BasePlugin } from "./plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

const snapshotLabelSymbol = Symbol("snapshotLabel");

export interface SnapshotLabel {
    error: any;
    query: Record<string, any>;
    values: { tick: number; timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export interface Snapshot {
    observables: Map<Observable<any>, ObservableSnapshot>;
    subscribers: Map<Subscriber<any>, SubscriberSnapshot>;
    subscriptions: Map<Subscription, SubscriptionSnapshot>;
    tick: number;
    mapStackTraces(observableSnapshots: ObservableSnapshot[]): Observable<void>;
    mapStackTraces(subscriberSnapshots: SubscriberSnapshot[]): Observable<void>;
    mapStackTraces(subscriptionSnapshots: SubscriptionSnapshot[]): Observable<void>;
}

export interface ObservableSnapshot {
    id: string;
    observable: Observable<any>;
    path: string;
    subscriptions: Map<Subscription, SubscriptionSnapshot>;
    tag: string | undefined;
    tick: number;
    type: string;
}

export interface SubscriberSnapshot {
    id: string;
    subscriber: Subscriber<any>;
    subscriptions: Map<Subscription, SubscriptionSnapshot>;
    tick: number;
    values: { tick: number; timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export interface SubscriptionSnapshot {
    completeTimestamp: number;
    error: any;
    errorTimestamp: number;
    flats: Map<Subscription, SubscriptionSnapshot>;
    flatsFlushed: number;
    flattened: boolean;
    id: string;
    mappedStackTrace: Observable<StackFrame[]>;
    nextCount: number;
    nextTimestamp: number;
    observable: Observable<any>;
    query: Record<string, any>;
    rootSink: SubscriptionSnapshot | undefined;
    sink: SubscriptionSnapshot | undefined;
    sources: Map<Subscription, SubscriptionSnapshot>;
    sourcesFlushed: number;
    stackTrace: StackFrame[];
    subscribeTimestamp: number;
    subscriber: Subscriber<any>;
    subscription: Subscription;
    tick: number;
    unsubscribeTimestamp: number;
    values: { tick: number; timestamp: number; value: any; }[];
    valuesFlushed: number;
}

type FindPlugins = {
    graphPlugin: GraphPlugin | undefined;
    stackTracePlugin: StackTracePlugin | undefined;
};

export class SnapshotPlugin extends BasePlugin {

    private foundPlugins_: FindPlugins | undefined;
    private keptValues_: number;
    private spy_: Spy;

    constructor({
        keptValues = 4,
        spy
    }: {
        keptValues?: number,
        spy: Spy
    }) {

        super("snapshot");

        this.foundPlugins_ = undefined;
        this.keptValues_ = keptValues;
        this.spy_ = spy;
    }

    beforeError(subscription: Subscription, error: any): void {

        const snapshotLabel = this.getSnapshotLabel(subscription);
        snapshotLabel.error = error;
    }

    beforeNext(subscription: Subscription, value: any): void {

        const tick = this.spy_.tick;
        const snapshotLabel = this.getSnapshotLabel(subscription);
        snapshotLabel.values.push({ tick, timestamp: Date.now(), value });

        const { keptValues_ } = this;
        const count = snapshotLabel.values.length - keptValues_;
        if (count > 0) {
            snapshotLabel.values.splice(0, count);
            snapshotLabel.valuesFlushed += count;
        }
    }

    beforeSubscribe(subscription: Subscription): void {

        this.setSnapshotLabel_(subscription, {
            error: undefined,
            query: {},
            values: [],
            valuesFlushed: 0
        });
    }

    getSnapshotLabel(subscription: Subscription): SnapshotLabel {

        return subscription[snapshotLabelSymbol];
    }

    mapStackTraces(observableSnapshots: ObservableSnapshot[]): Observable<void>;
    mapStackTraces(subscriberSnapshots: SubscriberSnapshot[]): Observable<void>;
    mapStackTraces(subscriptionSnapshots: SubscriptionSnapshot[]): Observable<void>;
    mapStackTraces(snapshots: any[]): Observable<void> {

        const observables: Observable<any>[] = [of(null)];

        snapshots.forEach(snapshot => {

            if (snapshot.subscriptions) {
                snapshot.subscriptions.forEach(mapSubscriptionStackTraces);
            } else {
                mapSubscriptionStackTraces(snapshot);
            }
        });
        return forkJoin(observables).pipe(
            mapTo(undefined),
            hide()
        );

        function mapSubscriptionStackTraces(subscriptionSnapshot: SubscriptionSnapshot): void {

            observables.push(subscriptionSnapshot.mappedStackTrace);
            if (subscriptionSnapshot.rootSink) {
                observables.push(subscriptionSnapshot.rootSink.mappedStackTrace);
            }
        }
    }

    snapshotAll({
        since
    }: {
        since?: Snapshot
    } = {}): Snapshot {

        const observables = new Map<Observable<any>, ObservableSnapshot>();
        const subscribers = new Map<Subscriber<any>, SubscriberSnapshot>();
        const subscriptions = new Map<Subscription, SubscriptionSnapshot>();

        const { graphPlugin } = this.findPlugins_();
        if (graphPlugin) {

            const foundSubscriptions = this.findSubscriptions_();
            foundSubscriptions.forEach((unused, subscription) => {

                const {
                    completeTimestamp,
                    errorTimestamp,
                    nextCount,
                    nextTimestamp,
                    observable,
                    subscribeTimestamp,
                    subscriber,
                    tick,
                    unsubscribeTimestamp
                } = getSubscriptionLabel(subscription);

                const {
                    flatsFlushed,
                    flattened,
                    sourcesFlushed
                } = graphPlugin.getGraphLabel(subscription);

                const {
                    error,
                    query,
                    values,
                    valuesFlushed
                } = this.getSnapshotLabel(subscription);

                const { stackTracePlugin } = this.findPlugins_();
                const subscriptionSnapshot: SubscriptionSnapshot = {
                    completeTimestamp,
                    error,
                    errorTimestamp,
                    flats: new Map<Subscription, SubscriptionSnapshot>(),
                    flatsFlushed,
                    flattened,
                    id: identify(subscription),
                    mappedStackTrace: stackTracePlugin ?
                        stackTracePlugin.getMappedStackTrace(subscription) :
                        of([]),
                    nextCount,
                    nextTimestamp,
                    observable,
                    query,
                    rootSink: undefined,
                    sink: undefined,
                    sources: new Map<Subscription, SubscriptionSnapshot>(),
                    sourcesFlushed,
                    stackTrace: stackTracePlugin ?
                        stackTracePlugin.getStackTrace(subscription) :
                        [],
                    subscribeTimestamp,
                    subscriber,
                    subscription,
                    tick,
                    unsubscribeTimestamp,
                    values,
                    valuesFlushed
                };
                subscriptions.set(subscription, subscriptionSnapshot);

                let subscriberSnapshot = subscribers.get(subscriber);
                if (!subscriberSnapshot) {
                    subscriberSnapshot = {
                        id: identify(subscriber),
                        subscriber,
                        subscriptions: new Map<Subscription, SubscriptionSnapshot>(),
                        tick,
                        values: [],
                        valuesFlushed: 0
                    };
                    subscribers.set(subscriber, subscriberSnapshot);
                }
                subscriberSnapshot.subscriptions.set(subscription, subscriptionSnapshot);
                subscriberSnapshot.tick = Math.max(subscriberSnapshot.tick, tick);
                subscriberSnapshot.values.push(...values);
                subscriberSnapshot.valuesFlushed += valuesFlushed;

                let observableSnapshot = observables.get(observable);
                if (!observableSnapshot) {
                    observableSnapshot = {
                        id: identify(observable),
                        observable,
                        path: inferPath(observable),
                        subscriptions: new Map<Subscription, SubscriptionSnapshot>(),
                        tag: read(observable),
                        tick,
                        type: inferType(observable)
                    };
                    observables.set(observable, observableSnapshot);
                }
                observableSnapshot.subscriptions.set(subscription, subscriptionSnapshot);
                observableSnapshot.tick = Math.max(observableSnapshot.tick, tick);
            });

            foundSubscriptions.forEach((unused, subscription) => {

                const graphLabel = graphPlugin.getGraphLabel(subscription);
                const subscriptionSnapshot = subscriptions.get(subscription)!;

                if (graphLabel.sink) {
                    subscriptionSnapshot.sink = subscriptions.get(graphLabel.sink)!;
                }
                if (graphLabel.rootSink) {
                    subscriptionSnapshot.rootSink = subscriptions.get(graphLabel.rootSink)!;
                }
                graphLabel.flats.forEach(flat => subscriptionSnapshot.flats.set(flat, subscriptions.get(flat)!));
                graphLabel.sources.forEach(source => subscriptionSnapshot.sources.set(source, subscriptions.get(source)!));
            });

            subscribers.forEach(subscriberSnapshot => {

                subscriberSnapshot.values.sort((a, b) => a.tick - b.tick);
            });

            if (since !== undefined) {

                observables.forEach((value, key) => {
                    if (value.tick <= since.tick) {
                        observables.delete(key);
                    }
                });

                subscribers.forEach((value, key) => {
                    if (value.tick <= since.tick) {
                        subscribers.delete(key);
                    }
                });

                subscriptions.forEach((value, key) => {
                    if (value.tick <= since.tick) {
                        subscriptions.delete(key);
                    }
                });
            }
        }

        return {
            mapStackTraces: this.mapStackTraces.bind(this),
            observables,
            subscribers,
            subscriptions,
            tick: this.spy_.tick
        };
    }

    private addSubscriptions_(subscription: Subscription, map: Map<Subscription, boolean>): void {

        map.set(subscription, true);

        const { graphPlugin } = this.findPlugins_();
        if (graphPlugin) {
            const graphLabel = graphPlugin.getGraphLabel(subscription);
            graphLabel.flats.forEach(flat => this.addSubscriptions_(flat, map));
            graphLabel.sources.forEach(source => this.addSubscriptions_(source, map));
        }
    }

    private findPlugins_(): FindPlugins {

        const { foundPlugins_, spy_ } = this;
        if (foundPlugins_) {
            return foundPlugins_;
        }

        const [graphPlugin] = spy_.find(GraphPlugin);
        const [stackTracePlugin] = spy_.find(StackTracePlugin);

        if (!graphPlugin) {
            spy_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the SnapshotPlugin.");
        }

        this.foundPlugins_ = { graphPlugin, stackTracePlugin };
        return this.foundPlugins_;
    }

    private findSubscriptions_(): Map<Subscription, boolean> {

        const map = new Map<Subscription, boolean>();

        const { graphPlugin } = this.findPlugins_();
        if (graphPlugin) {
            const roots = graphPlugin.findRootSubscriptions();
            roots.forEach(root => this.addSubscriptions_(root, map));
        }
        return map;
    }

    private setSnapshotLabel_(subscription: Subscription, label: SnapshotLabel): SnapshotLabel {

        subscription[snapshotLabelSymbol] = label;
        return label;
    }
}
