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
import { getSubscriptionRef } from "../subscription-ref";
import { inferPath, inferType } from "../util";
import { getGraphRef, GraphPlugin } from "./graph-plugin";
import { BasePlugin } from "./plugin";
import { getMappedStackTrace, getStackTrace } from "./stack-trace-plugin";

const snapshotRefSymbol = Symbol("snapshotRef");

export interface SnapshotRef {
    error: any;
    query: Record<string, any>;
    values: { tick: number; timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export function getSnapshotRef(subscription: Subscription): SnapshotRef {

    return subscription[snapshotRefSymbol];
}

function mapStackTraces(observableSnapshots: ObservableSnapshot[]): Observable<void>;
function mapStackTraces(subscriberSnapshots: SubscriberSnapshot[]): Observable<void>;
function mapStackTraces(subscriptionSnapshots: SubscriptionSnapshot[]): Observable<void>;
function mapStackTraces(snapshots: any[]): Observable<void> {

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

function setSnapshotRef(subscription: Subscription, value: SnapshotRef): SnapshotRef {

    subscription[snapshotRefSymbol] = value;
    return value;
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

export class SnapshotPlugin extends BasePlugin {

    private graphPlugin_: GraphPlugin | undefined;
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

        this.graphPlugin_ = undefined;
        this.keptValues_ = keptValues;
        this.spy_ = spy;
    }

    beforeError(subscription: Subscription, error: any): void {

        const snapshotRef = getSnapshotRef(subscription);
        snapshotRef.error = error;
    }

    beforeNext(subscription: Subscription, value: any): void {

        const tick = this.spy_.tick;
        const snapshotRef = getSnapshotRef(subscription);
        snapshotRef.values.push({ tick, timestamp: Date.now(), value });

        const { keptValues_ } = this;
        const count = snapshotRef.values.length - keptValues_;
        if (count > 0) {
            snapshotRef.values.splice(0, count);
            snapshotRef.valuesFlushed += count;
        }
    }

    beforeSubscribe(subscription: Subscription): void {

        setSnapshotRef(subscription, {
            error: undefined,
            query: {},
            values: [],
            valuesFlushed: 0
        });

        const { graphPlugin_, spy_ } = this;
        if (!graphPlugin_) {
            this.graphPlugin_ = spy_.find(GraphPlugin);
            if (!this.graphPlugin_) {
                spy_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the SnapshotPlugin.");
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
            } = getSubscriptionRef(subscription);

            const {
                flatsFlushed,
                flattened,
                sourcesFlushed
            } = getGraphRef(subscription);

            const {
                error,
                query,
                values,
                valuesFlushed
            } = getSnapshotRef(subscription);

            const subscriptionSnapshot: SubscriptionSnapshot = {
                completeTimestamp,
                error,
                errorTimestamp,
                flats: new Map<Subscription, SubscriptionSnapshot>(),
                flatsFlushed,
                flattened,
                id: identify(subscription),
                mappedStackTrace: getMappedStackTrace(subscription),
                nextCount,
                nextTimestamp,
                observable,
                query,
                rootSink: undefined,
                sink: undefined,
                sources: new Map<Subscription, SubscriptionSnapshot>(),
                sourcesFlushed,
                stackTrace: getStackTrace(subscription),
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

            const graphRef = getGraphRef(subscription);
            const subscriptionSnapshot = subscriptions.get(subscription)!;

            if (graphRef.sink) {
                subscriptionSnapshot.sink = subscriptions.get(graphRef.sink)!;
            }
            if (graphRef.rootSink) {
                subscriptionSnapshot.rootSink = subscriptions.get(graphRef.rootSink)!;
            }
            graphRef.flats.forEach(flat => subscriptionSnapshot.flats.set(flat, subscriptions.get(flat)!));
            graphRef.sources.forEach(source => subscriptionSnapshot.sources.set(source, subscriptions.get(source)!));
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

        return {
            mapStackTraces,
            observables,
            subscribers,
            subscriptions,
            tick: this.spy_.tick
        };
    }

    private addSubscriptions_(subscription: Subscription, map: Map<Subscription, boolean>): void {

        map.set(subscription, true);

        const graphRef = getGraphRef(subscription);
        graphRef.flats.forEach(flat => this.addSubscriptions_(flat, map));
        graphRef.sources.forEach(source => this.addSubscriptions_(source, map));
    }

    private findSubscriptions_(): Map<Subscription, boolean> {

        const { graphPlugin_ } = this;
        const map = new Map<Subscription, boolean>();

        if (graphPlugin_) {
            const roots = graphPlugin_.findRootSubscriptions();
            roots.forEach(root => this.addSubscriptions_(root, map));
        }
        return map;
    }
}
