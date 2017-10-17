/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { StackFrame } from "stacktrace-js";
import { read } from "../match";
import { getGraphRef } from "./graph-plugin";
import { BasePlugin, Notification, SubscriptionRef } from "./plugin";
import { getStackTrace } from "./stack-trace-plugin";
import { tick } from "../tick";

export { SubscriptionRef };

const snapshotRefSymbol = Symbol("snapshotRef");

export interface SnapshotRef {
    complete: boolean;
    error: any;
    tick: number;
    timestamp: number;
    unsubscribed: boolean;
    values: { tick: number; timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export function getSnapshotRef(ref: SubscriptionRef): SnapshotRef {

    return ref[snapshotRefSymbol];
}

function setSnapshotRef(ref: SubscriptionRef, value: SnapshotRef): SnapshotRef {

    ref[snapshotRefSymbol] = value;
    return value;
}

export interface Snapshot {
    observables: Map<Observable<any>, ObservableSnapshot>;
    subscribers: Map<Subscriber<any>, SubscriberSnapshot>;
    subscriptions: Map<SubscriptionRef, SubscriptionSnapshot>;
    tick: number;
}

export interface ObservableSnapshot {
    observable: Observable<any>;
    subscribers: Map<Subscriber<any>, SubscriberSnapshot>;
    tag: string | null;
    tick: number;
}

export interface SubscriberSnapshot {
    subscriber: Subscriber<any>;
    subscriptions: Map<SubscriptionRef, SubscriptionSnapshot>;
    tick: number;
    values: { tick: number; timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export interface SubscriptionSnapshot {
    complete: boolean;
    destination: SubscriptionSnapshot | null;
    error: any;
    merges: Map<SubscriptionRef, SubscriptionSnapshot>;
    observable: Observable<any>;
    ref: SubscriptionRef;
    rootDestination: SubscriptionSnapshot | null;
    sources: Map<SubscriptionRef, SubscriptionSnapshot>;
    stackTrace: StackFrame[];
    subscriber: Subscriber<any>;
    tick: number;
    timestamp: number;
    unsubscribed: any;
}

export class SnapshotPlugin extends BasePlugin {

    private rootSubscriptionRefs_: Map<SubscriptionRef, boolean>;
    private keptValues_: number;

    constructor({
        keptValues = 4
    }: {
        keptValues?: number
    } = {}) {

        super();

        this.rootSubscriptionRefs_ = new Map<SubscriptionRef, boolean>();
        this.keptValues_ = keptValues;
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        const snapshotRef = getSnapshotRef(ref);
        snapshotRef.tick = tick();
        snapshotRef.unsubscribed = true;
    }

    beforeComplete(ref: SubscriptionRef): void {

        const snapshotRef = getSnapshotRef(ref);
        snapshotRef.tick = tick();
        snapshotRef.complete = true;
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        const snapshotRef = getSnapshotRef(ref);
        snapshotRef.tick = tick();
        snapshotRef.error = error;
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const t = tick();
        const snapshotRef = getSnapshotRef(ref);
        snapshotRef.tick = t;
        snapshotRef.values.push({ tick: t, timestamp: Date.now(), value });

        const { keptValues_ } = this;
        const count = snapshotRef.values.length - keptValues_;
        if (count > 0) {
            snapshotRef.values.splice(0, count);
            snapshotRef.valuesFlushed += count;
        }
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const { rootSubscriptionRefs_ } = this;

        const snapshotRef = setSnapshotRef(ref, {
            complete: false,
            error: null,
            tick: tick(),
            timestamp: Date.now(),
            unsubscribed: false,
            values: [],
            valuesFlushed: 0
        });
        const graphRef = getGraphRef(ref);

        if (!graphRef) {
            /*tslint:disable-next-line:no-console*/
            console.warn("Graphing is not enabled.");
        }

        if (graphRef && !graphRef.rootDestination) {
            rootSubscriptionRefs_.set(ref, true);
        }
    }

    flush(options?: {
        completed?: boolean,
        errored?: boolean
    }): void {

        const { completed, errored } = options || {
            completed: true,
            errored: true
        };
        const { rootSubscriptionRefs_ } = this;

        rootSubscriptionRefs_.forEach((unused, ref) => {

            const snapshotRef = getSnapshotRef(ref);
            if (completed && snapshotRef.complete) {
                rootSubscriptionRefs_.delete(ref);
            }
            if (errored && snapshotRef.error) {
                rootSubscriptionRefs_.delete(ref);
            }
        });
    }

    snapshotAll({
        since
    }: {
        since?: Snapshot
    } = {}): Snapshot {

        const observables = new Map<Observable<any>, ObservableSnapshot>();
        const subscribers = new Map<Subscriber<any>, SubscriberSnapshot>();
        const subscriptions = new Map<SubscriptionRef, SubscriptionSnapshot>();

        const subscriptionRefs = this.getSubscriptionRefs_();
        subscriptionRefs.forEach((unused, ref) => {

            const { observable, subscriber } = ref;

            const snapshotRef = getSnapshotRef(ref);
            const { complete, error, tick, timestamp, unsubscribed, values, valuesFlushed } = snapshotRef;

            const subscriptionSnapshot: SubscriptionSnapshot = {
                complete,
                destination: null,
                error,
                merges: new Map<SubscriptionRef, SubscriptionSnapshot>(),
                observable,
                ref,
                rootDestination: null,
                sources: new Map<SubscriptionRef, SubscriptionSnapshot>(),
                stackTrace: getStackTrace(ref),
                subscriber,
                tick,
                timestamp,
                unsubscribed
            };
            subscriptions.set(ref, subscriptionSnapshot);

            let subscriberSnapshot = subscribers.get(subscriber);
            if (!subscriberSnapshot) {
                subscriberSnapshot = {
                    subscriber,
                    subscriptions: new Map<SubscriptionRef, SubscriptionSnapshot>(),
                    tick,
                    values: [],
                    valuesFlushed: 0
                };
                subscribers.set(subscriber, subscriberSnapshot);
            }
            subscriberSnapshot.subscriptions.set(ref, subscriptionSnapshot);
            subscriberSnapshot.tick = Math.max(subscriberSnapshot.tick, tick);
            subscriberSnapshot.values.push(...values);
            subscriberSnapshot.valuesFlushed += valuesFlushed;

            let observableSnapshot = observables.get(observable);
            if (!observableSnapshot) {
                observableSnapshot = {
                    observable,
                    subscribers: new Map<Subscriber<any>, SubscriberSnapshot>(),
                    tag: read(observable),
                    tick
                };
                observables.set(observable, observableSnapshot);
            }
            observableSnapshot.subscribers.set(subscriber, subscriberSnapshot);
            observableSnapshot.tick = Math.max(observableSnapshot.tick, tick);
        });

        subscriptionRefs.forEach((unused, ref) => {

            const graphRef = getGraphRef(ref);
            const subscriptionSnapshot = subscriptions.get(ref)!;

            if (graphRef.destination) {
                subscriptionSnapshot.destination = subscriptions.get(graphRef.destination)!;
            }
            if (graphRef.rootDestination) {
                subscriptionSnapshot.rootDestination = subscriptions.get(graphRef.rootDestination)!;
            }
            graphRef.merges.forEach((m) => subscriptionSnapshot.merges.set(m, subscriptions.get(m)!));
            graphRef.sources.forEach((s) => subscriptionSnapshot.sources.set(s, subscriptions.get(s)!));
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
            observables,
            subscribers,
            subscriptions,
            tick: tick()
        };
    }

    snapshotObservable(ref: SubscriptionRef): ObservableSnapshot | null {

        const snapshot = this.snapshotAll();
        return snapshot.observables.get(ref.observable) || null;
    }

    snapshotSubscriber(ref: SubscriptionRef): SubscriberSnapshot | null {

        const snapshot = this.snapshotAll();
        return snapshot.subscribers.get(ref.subscriber) || null;
    }

    private addSubscriptionRefs_(ref: SubscriptionRef, map: Map<SubscriptionRef, boolean>): void {

        map.set(ref, true);

        const graphRef = getGraphRef(ref);
        graphRef.merges.forEach((m) => this.addSubscriptionRefs_(m, map));
        graphRef.sources.forEach((s) => this.addSubscriptionRefs_(s, map));
    }

    private getSubscriptionRefs_(): Map<SubscriptionRef, boolean> {

        const { rootSubscriptionRefs_ } = this;
        const map = new Map<SubscriptionRef, boolean>();
        rootSubscriptionRefs_.forEach((unused, ref) => this.addSubscriptionRefs_(ref, map));
        return map;
    }
}

function map<K, V>(from: Map<K, V>, to: Map<K, V>): Map<K, V> {

    const mapped = new Map<K, V>();
    from.forEach((value, key) => {
        mapped.set(key, to.get(key)!);
    });
    return mapped;
}
