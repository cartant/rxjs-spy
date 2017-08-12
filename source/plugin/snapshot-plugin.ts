/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { get, getSync, StackFrame } from "stacktrace-js";
import { read } from "../match";
import { BasePlugin, Notification, SubscriptionRef } from "./plugin";
import { tick } from "../spy";

export { SubscriptionRef };

export interface Snapshot {
    observables: Map<Observable<any>, ObservableSnapshot>;
    subscribers: Map<Subscriber<any>, SubscriberSnapshot>;
    subscriptions: Map<SubscriptionRef, SubscriptionSnapshot>;
    tick: number;
}

export interface ObservableSnapshot {
    complete: boolean;
    destinations: Map<Observable<any>, ObservableSnapshot>;
    error: any;
    observable: Observable<any>;
    sources: Map<Observable<any>, ObservableSnapshot>;
    subscribers: Map<Subscriber<any>, SubscriberSnapshot>;
    tag: string | null;
    tick: number;
    type: string;
}

export interface SubscriberSnapshot {
    subscriber: Subscriber<any>;
    subscriptions: Map<SubscriptionRef, SubscriptionSnapshot>;
    tick: number;
    values: { timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export interface SubscriptionSnapshot {
    destination: SubscriptionSnapshot | null;
    finalDestination: SubscriptionSnapshot | null;
    merges: Map<SubscriptionRef, SubscriptionSnapshot>;
    ref: SubscriptionRef;
    stackTrace: StackFrame[];
    tick: number;
    timestamp: number;
}

interface NotificationSnapshot {
    notification: Notification;
    observable: ObservableSnapshot | null;
    subscriber: SubscriberSnapshot | null;
    subscription: SubscriptionSnapshot | null;
}

export class SnapshotPlugin extends BasePlugin {

    private keptValues_: number;
    private observables_: Map<Observable<any>, ObservableSnapshot>;
    private notifications_: NotificationSnapshot[];
    private sourceMaps_: boolean;
    private subscribers_: Map<Subscriber<any>, SubscriberSnapshot>;
    private subscriptions_: Map<SubscriptionRef, SubscriptionSnapshot>;

    constructor({
        keptValues = 4,
        sourceMaps = false
    }: {
        keptValues?: number
        sourceMaps?: boolean
    } = {}) {

        super();

        this.keptValues_ = keptValues;
        this.observables_ = new Map<Observable<any>, ObservableSnapshot>();
        this.notifications_ = [];
        this.sourceMaps_ = sourceMaps;
        this.subscribers_ = new Map<Subscriber<any>, SubscriberSnapshot>();
        this.subscriptions_ = new Map<SubscriptionRef, SubscriptionSnapshot>();
    }

    afterComplete(ref: SubscriptionRef): void {

        const { notifications_ } = this;

        const notification = notifications_.pop();
        if (notification) {

            const { observable } = notification;
            if (observable) {
                observable.complete = true;
                observable.subscribers.clear();
            }
        }
    }

    afterError(ref: SubscriptionRef, error: any): void {

        const { notifications_ } = this;

        const notification = notifications_.pop();
        if (notification) {

            const { observable } = notification;
            if (observable) {
                observable.error = error;
                observable.subscribers.clear();
            }
        }
    }

    afterNext(ref: SubscriptionRef, value: any): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    afterSubscribe(ref: SubscriptionRef): void {

        const { notifications_ } = this;
        notifications_.pop();
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        const { notifications_ } = this;
        const { subscriber } = ref;

        const notification = notifications_.pop();
        if (notification) {

            const { observable } = notification;
            if (observable) {
                observable.subscribers.delete(subscriber);
            }
        }
    }

    beforeComplete(ref: SubscriptionRef): void {

        this.push("complete", ref);
    }

    beforeError(ref: SubscriptionRef, error: any): void {

        this.push("error", ref);
    }

    beforeNext(ref: SubscriptionRef, value: any): void {

        const { subscriber } = this.push("next", ref);
        const timestamp = Date.now();

        if (subscriber) {
            subscriber.values.push({ timestamp, value });
        }
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const { observables_, notifications_, sourceMaps_, subscribers_, subscriptions_ } = this;
        const { observable, subscriber } = ref;

        let observableSnapshot = observables_.get(observable);
        if (observableSnapshot) {
            observableSnapshot.tick = tick();
        } else {
            const tag = read(observable);
            observableSnapshot = {
                complete: false,
                destinations: new Map<Observable<any>, ObservableSnapshot>(),
                error: null,
                observable,
                sources: new Map<Observable<any>, ObservableSnapshot>(),
                subscribers: new Map<Subscriber<any>, SubscriberSnapshot>(),
                tag,
                tick: tick(),
                type: getType(observable)
            };
            observables_.set(observable, observableSnapshot);
        }

        let subscriberSnapshot = subscribers_.get(subscriber);
        if (subscriberSnapshot) {
            subscriberSnapshot.tick = tick();
        } else {
            subscriberSnapshot = {
                subscriber,
                subscriptions: new Map<SubscriptionRef, SubscriptionSnapshot>(),
                tick: tick(),
                values: [],
                valuesFlushed: 0
            };
            subscribers_.set(subscriber, subscriberSnapshot);
            observableSnapshot.subscribers.set(subscriber, subscriberSnapshot);
        }

        const subscriptionSnapshot: SubscriptionSnapshot = {
            destination: null,
            finalDestination: null,
            merges: new Map<SubscriptionRef, SubscriptionSnapshot>(),
            ref,
            stackTrace: getStackTrace(sourceMaps_),
            tick: tick(),
            timestamp: Date.now()
        };
        subscriptions_.set(ref, subscriptionSnapshot);
        subscriberSnapshot.subscriptions.set(ref, subscriptionSnapshot);

        const length = notifications_.length;
        if ((length > 0) && (notifications_[length - 1].notification === "next")) {

            const {
                subscription: destinationSubscriptionSnapshot
            } = notifications_[length - 1];

            if (destinationSubscriptionSnapshot) {
                destinationSubscriptionSnapshot.merges.set(ref, subscriptionSnapshot);
                subscriptionSnapshot.destination = destinationSubscriptionSnapshot;
                subscriptionSnapshot.finalDestination =
                    destinationSubscriptionSnapshot.finalDestination || destinationSubscriptionSnapshot;
            }
        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notifications_[n].notification === "subscribe") {

                    const {
                        observable: destinationObservableSnapshot,
                        subscription: destinationSubscriptionSnapshot
                    } = notifications_[n];

                    if (destinationObservableSnapshot) {
                        destinationObservableSnapshot.sources.set(
                            observable,
                            observableSnapshot
                        );
                        observableSnapshot.destinations.set(
                            destinationObservableSnapshot.observable,
                            destinationObservableSnapshot
                        );
                    }
                    if (destinationSubscriptionSnapshot) {
                        subscriptionSnapshot.destination = destinationSubscriptionSnapshot;
                        subscriptionSnapshot.finalDestination =
                            destinationSubscriptionSnapshot.finalDestination || destinationSubscriptionSnapshot;
                    }
                    break;
                }
            }
        }

        notifications_.push({
            notification: "subscribe",
            observable: observableSnapshot,
            subscriber: subscriberSnapshot,
            subscription: subscriptionSnapshot
        });
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {

        this.push("unsubscribe", ref);
    }

    flush(options?: {
        completed?: boolean,
        errored?: boolean
    }): void {

        const { completed, errored } = options || {
            completed: true,
            errored: true
        };
        const { keptValues_, observables_ } = this;

        flushObservables(this.observables_);
        flushSubscribers(this.subscribers_);
        flushSubscriptions(this.subscriptions_);

        function flushObservables(observables: Map<Observable<any>, ObservableSnapshot>): void {

            observables.forEach((o) => {

                if ((completed && o.complete) || (errored && o.error)) {
                    observables.delete(o.observable);
                } else {
                    flushSubscribers(o.subscribers);
                }
            });
        }

        function flushSubscribers(subscribers: Map<Subscriber<any>, SubscriberSnapshot>): void {

            subscribers.forEach((s) => {

                flushSubscriptions(s.subscriptions);

                if (s.subscriptions.size === 0) {
                    subscribers.delete(s.subscriber);
                } else {
                    const count = s.values.length - keptValues_;
                    if (count > 0) {
                        s.values.splice(0, count);
                        s.valuesFlushed += count;
                    }
                }
            });
        }

        function flushSubscriptions(subscriptions: Map<SubscriptionRef, SubscriptionSnapshot>): void {

            subscriptions.forEach((s) => {

                flushSubscriptions(s.merges);

                const { ref } = s;
                const { subscription } = ref;

                if (subscription && subscription.closed) {
                    subscriptions.delete(ref);
                }
            });
        }
    }

    snapshotAll({
        since
    }: {
        since?: Snapshot
    } = {}): Snapshot {

        const { observables_, subscribers_, subscriptions_ } = this;
        const observables = new Map<Observable<any>, ObservableSnapshot>();
        const subscribers = new Map<Subscriber<any>, SubscriberSnapshot>();
        const subscriptions = new Map<SubscriptionRef, SubscriptionSnapshot>();

        observables_.forEach((value, key) => {
            observables.set(key, { ...value });
        });

        subscribers_.forEach((value, key) => {
            subscribers.set(key, { ...value, values: [...value.values] });
        });

        subscriptions_.forEach((value, key) => {
            subscriptions.set(key, { ...value });
        });

        observables.forEach((value, key) => {
            value.destinations = map(value.destinations, observables);
            value.sources = map(value.sources, observables);
            value.subscribers = map(value.subscribers, subscribers);
        });

        subscribers.forEach((value, key) => {
            value.subscriptions = map(value.subscriptions, subscriptions);
        });

        subscriptions.forEach((value, key) => {
            if (value.destination) {
                value.destination = subscriptions.get(value.destination.ref)!;
            }
            if (value.finalDestination) {
                value.finalDestination = subscriptions.get(value.finalDestination.ref)!;
            }
            value.merges = map(value.merges, subscriptions);
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

    private push(notification: Notification, ref: SubscriptionRef): NotificationSnapshot {

        const notificationSnapshot: NotificationSnapshot = {
            notification,
            observable: null,
            subscriber: null,
            subscription: null
        };
        const { observables_, notifications_, subscribers_, subscriptions_ } = this;
        const { observable, subscriber } = ref;

        notificationSnapshot.observable = observables_.get(observable) || null;
        if (notificationSnapshot.observable) {
            notificationSnapshot.observable.tick = tick();
        }

        notificationSnapshot.subscriber = subscribers_.get(subscriber) || null;
        if (notificationSnapshot.subscriber) {
            notificationSnapshot.subscriber.tick = tick();
        }

        notificationSnapshot.subscription = subscriptions_.get(ref) || null;
        if (notificationSnapshot.subscription) {
            notificationSnapshot.subscription.tick = tick();
        }

        notifications_.push(notificationSnapshot);
        return notificationSnapshot;
    }
}

function getStackTrace(sourceMaps: boolean): StackFrame[] {

    const options = () => {

        let preSubscribeWithSpy = false;
        return {
            filter: (stackFrame: StackFrame) => {
                const result = preSubscribeWithSpy;
                if (/subscribeWithSpy/.test(stackFrame.functionName)) {
                    preSubscribeWithSpy = true;
                }
                return result;
            }
        };
    };

    const result = getSync(options());

    if (sourceMaps && (typeof document !== "undefined")) {
        get(options()).then((stackFrames) => {
            result.splice(0, result.length, ...stackFrames);
        });
    }
    return result;
}

function getType(observable: Observable<any>): string {

    const prototype = Object.getPrototypeOf(observable);
    if (prototype.constructor && prototype.constructor.name) {
        return prototype.constructor.name;
    }
    return "Object";
}

function map<K, V>(from: Map<K, V>, to: Map<K, V>): Map<K, V> {

    const mapped = new Map<K, V>();
    from.forEach((value, key) => {
        mapped.set(key, to.get(key)!);
    });
    return mapped;
}
