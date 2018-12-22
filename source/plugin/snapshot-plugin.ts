/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { StackFrame } from "error-stack-parser";
import { forkJoin, Observable, of, Subscriber, Subscription } from "rxjs";
import { mapTo } from "rxjs/operators";
import { getGraphRef, GraphRef } from "./graph-plugin";
import { identify } from "../identify";
import { read } from "../match";
import { hide } from "../operators";
import { BasePlugin, Notification } from "./plugin";
import { Spy } from "../spy-interface";
import { getMappedStackTrace, getStackTrace } from "./stack-trace-plugin";
import { SubscriptionRef } from "../subscription-ref";
import { inferPath, inferType } from "../util";

const snapshotRefSymbol = Symbol("snapshotRef");

export interface SnapshotRef {
    error: any;
    query: Record<string, any>;
    values: { tick: number; timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export function getSnapshotRef(ref: SubscriptionRef): SnapshotRef {

    return ref[snapshotRefSymbol];
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

function setSnapshotRef(ref: SubscriptionRef, value: SnapshotRef): SnapshotRef {

    ref[snapshotRefSymbol] = value;
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

    private keptValues_: number;
    private sentinel_: GraphRef | undefined;
    private spy_: Spy;

    constructor(spy: Spy, {
        keptValues = 4
    }: {
        keptValues?: number
    } = {}) {

        super("snapshot");

        this.keptValues_ = keptValues;
        this.sentinel_ = undefined;
        this.spy_ = spy;
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        const snapshotRef = getSnapshotRef(ref);
        snapshotRef.error = error;
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const tick = this.spy_.tick;
        const snapshotRef = getSnapshotRef(ref);
        snapshotRef.values.push({ tick, timestamp: Date.now(), value });

        const { keptValues_ } = this;
        const count = snapshotRef.values.length - keptValues_;
        if (count > 0) {
            snapshotRef.values.splice(0, count);
            snapshotRef.valuesFlushed += count;
        }
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const snapshotRef = setSnapshotRef(ref, {
            error: undefined,
            query: {},
            values: [],
            valuesFlushed: 0
        });

        const graphRef = getGraphRef(ref);
        if (graphRef) {
            this.sentinel_ = graphRef.sentinel;
        } else {
            this.spy_.logger.warnOnce("Graphing is not enabled; add the GraphPlugin before the SnapshotPlugin.");
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

        const subscriptionRefs = this.getSubscriptionRefs_();
        subscriptionRefs.forEach((unused, ref) => {

            const {
                completeTimestamp,
                errorTimestamp,
                nextCount,
                nextTimestamp,
                observable,
                subscribeTimestamp,
                subscriber,
                subscription,
                tick,
                unsubscribeTimestamp
            } = ref;

            const graphRef = getGraphRef(ref);
            const { flatsFlushed, flattened, sourcesFlushed } = graphRef;

            const snapshotRef = getSnapshotRef(ref);
            const {
                error,
                values,
                valuesFlushed
            } = snapshotRef;

            const subscriptionSnapshot: SubscriptionSnapshot = {
                completeTimestamp,
                error,
                errorTimestamp,
                flats: new Map<Subscription, SubscriptionSnapshot>(),
                flatsFlushed,
                flattened,
                id: identify(subscription),
                mappedStackTrace: getMappedStackTrace(ref),
                nextCount,
                nextTimestamp,
                observable,
                query: snapshotRef.query,
                rootSink: undefined,
                sink: undefined,
                sources: new Map<Subscription, SubscriptionSnapshot>(),
                sourcesFlushed,
                stackTrace: getStackTrace(ref),
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

        subscriptionRefs.forEach((unused, ref) => {

            const graphRef = getGraphRef(ref);
            const subscriptionSnapshot = subscriptions.get(ref.subscription)!;

            if (graphRef.sink) {
                subscriptionSnapshot.sink = subscriptions.get(graphRef.sink.subscription)!;
            }
            if (graphRef.rootSink) {
                subscriptionSnapshot.rootSink = subscriptions.get(graphRef.rootSink.subscription)!;
            }
            graphRef.flats.forEach((m) => subscriptionSnapshot.flats.set(m.subscription, subscriptions.get(m.subscription)!));
            graphRef.sources.forEach((s) => subscriptionSnapshot.sources.set(s.subscription, subscriptions.get(s.subscription)!));
        });

        subscribers.forEach((subscriberSnapshot) => {

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

    snapshotObservable(ref: SubscriptionRef): ObservableSnapshot | undefined {

        const snapshot = this.snapshotAll();
        return snapshot.observables.get(ref.observable);
    }

    snapshotSubscriber(ref: SubscriptionRef): SubscriberSnapshot | undefined {

        const snapshot = this.snapshotAll();
        return snapshot.subscribers.get(ref.subscriber);
    }

    private addSubscriptionRefs_(ref: SubscriptionRef, map: Map<SubscriptionRef, boolean>): void {

        map.set(ref, true);

        const graphRef = getGraphRef(ref);
        graphRef.flats.forEach((m) => this.addSubscriptionRefs_(m, map));
        graphRef.sources.forEach((s) => this.addSubscriptionRefs_(s, map));
    }

    private getSubscriptionRefs_(): Map<SubscriptionRef, boolean> {

        const { sentinel_ } = this;
        const map = new Map<SubscriptionRef, boolean>();

        if (sentinel_) {
            sentinel_.sources.forEach(ref => this.addSubscriptionRefs_(ref, map));
        }
        return map;
    }
}
