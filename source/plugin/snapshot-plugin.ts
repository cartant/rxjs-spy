/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { get, getSync, StackFrame } from "stacktrace-js";
import { read } from "../match";
import { BasePlugin, Notification, SubscriptionRef } from "./plugin";
import { tick } from "../spy";

export interface Snapshot {
    observables: ObservableSnapshot[];
    tick: number;
}

export interface ObservableSnapshot {
    complete: boolean;
    destinations: ObservableSnapshot[];
    error: any;
    merges: ObservableSnapshot[];
    observable: Observable<any>;
    sources: ObservableSnapshot[];
    subscribers: SubscriberSnapshot[];
    tag: string | null;
    tick: number;
    type: string;
}

export interface SubscriberSnapshot {
    subscriber: Subscriber<any>;
    subscriptions: SubscriptionSnapshot[];
    tick: number;
    values: { timestamp: number; value: any; }[];
    valuesFlushed: number;
}

export interface SubscriptionSnapshot {
    destination: SubscriptionSnapshot | null;
    finalDestination: SubscriptionSnapshot | null;
    stackTrace: StackFrame[];
    timestamp: number;
}

interface ObservableRecord {
    complete: boolean;
    destinations: ObservableRecord[];
    error: any;
    merges: ObservableRecord[];
    observable: Observable<any>;
    sources: ObservableRecord[];
    subscribers: SubscriberRecord[];
    tag: string | null;
    tick: number;
    type: string;
}

interface SubscriberRecord {
    subscriber: Subscriber<any>;
    subscriptions: SubscriptionRecord[];
    tick: number;
    values: { timestamp: number; value: any; }[];
    valuesFlushed: number;
}

interface SubscriptionRecord {
    destination: SubscriptionRecord | null;
    ref: SubscriptionRef;
    stackTrace: StackFrame[];
    timestamp: number;
}

interface NotificationRecord {
    notification: Notification;
    observableRecord: ObservableRecord | null;
    subscriberRecord: SubscriberRecord | null;
    subscriptionRecord: SubscriptionRecord | null;
}

export class SnapshotPlugin extends BasePlugin {

    private keptValues_: number;
    private observableRecordsMap_: Map<Observable<any>, ObservableRecord>;
    private notificationRecordsStack_: NotificationRecord[] = [];
    private subscriberRecordsMap_: Map<Subscriber<any>, SubscriberRecord>;

    constructor({ keptValues = 4 }: { keptValues?: number } = {}) {

        super();

        this.keptValues_ = keptValues;
        this.observableRecordsMap_ = new Map<Observable<any>, ObservableRecord>();
        this.subscriberRecordsMap_ = new Map<Subscriber<any>, SubscriberRecord>();
    }

    afterComplete(ref: SubscriptionRef): void {

        const { notificationRecordsStack_ } = this;

        const notificationRecord = notificationRecordsStack_.pop();
        if (notificationRecord) {

            const { observableRecord } = notificationRecord;
            if (observableRecord) {
                observableRecord.complete = true;
                observableRecord.subscribers = [];
                observableRecord.tick = tick();
            }
        }
    }

    afterError(ref: SubscriptionRef, error: any): void {

        const { notificationRecordsStack_ } = this;

        const notificationRecord = notificationRecordsStack_.pop();
        if (notificationRecord) {

            const { observableRecord } = notificationRecord;
            if (observableRecord) {
                observableRecord.error = error;
                observableRecord.subscribers = [];
                observableRecord.tick = tick();
            }
        }
    }

    afterNext(ref: SubscriptionRef, value: any): void {

        const { notificationRecordsStack_ } = this;
        notificationRecordsStack_.pop();
    }

    afterSubscribe(ref: SubscriptionRef): void {

        const { notificationRecordsStack_ } = this;
        notificationRecordsStack_.pop();
    }

    afterUnsubscribe(ref: SubscriptionRef): void {

        const { notificationRecordsStack_ } = this;
        const { subscriber } = ref;

        const notificationRecord = notificationRecordsStack_.pop();
        if (notificationRecord) {

            const { observableRecord } = notificationRecord;
            if (observableRecord) {
                observableRecord.subscribers = observableRecord
                    .subscribers
                    .filter((s) => s.subscriber !== subscriber);
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

        const { observableRecord, subscriberRecord } = this.push("next", ref);
        const timestamp = Date.now();

        if (observableRecord) {
            observableRecord.tick = tick();
        }
        if (subscriberRecord) {
            subscriberRecord.values.push({ timestamp, value });
        }
    }

    beforeSubscribe(ref: SubscriptionRef): void {

        const { observableRecordsMap_, notificationRecordsStack_, subscriberRecordsMap_ } = this;
        const { observable, subscriber } = ref;

        let observableRecord = observableRecordsMap_.get(observable);
        if (observableRecord) {
            observableRecord.tick = tick();
        } else {
            const tag = read(observable);
            observableRecord = {
                complete: false,
                destinations: [],
                error: null,
                merges: [],
                observable,
                sources: [],
                subscribers: [],
                tag,
                tick: tick(),
                type: getType(observable)
            };
            observableRecordsMap_.set(observable, observableRecord);
        }

        let subscriberRecord = subscriberRecordsMap_.get(subscriber);
        if (subscriberRecord) {
            subscriberRecord.tick = tick();
        } else {
            subscriberRecord = {
                subscriber,
                subscriptions: [],
                tick: tick(),
                values: [],
                valuesFlushed: 0
            };
            subscriberRecordsMap_.set(subscriber, subscriberRecord);
            observableRecord.subscribers.push(subscriberRecord);
        }

        const subscriptionRecord: SubscriptionRecord = {
            destination: null,
            ref,
            stackTrace: getStackTrace(),
            timestamp: Date.now()
        };
        subscriberRecord.subscriptions.push(subscriptionRecord);

        const length = notificationRecordsStack_.length;
        if ((length > 0) && (notificationRecordsStack_[length - 1].notification === "next")) {

            const {
                observableRecord: sourceObservableRecord,
                subscriptionRecord: destinationSubscriptionRecord
            } = notificationRecordsStack_[length - 1];

            if (sourceObservableRecord) {
                addOnce(sourceObservableRecord.merges, observableRecord);
            }
            if (destinationSubscriptionRecord) {
                subscriptionRecord.destination = destinationSubscriptionRecord;
            }
        } else {
            for (let n = length - 1; n > -1; --n) {
                if (notificationRecordsStack_[n].notification === "subscribe") {

                    const {
                        observableRecord: destinationObservableRecord,
                        subscriptionRecord: destinationSubscriptionRecord
                    } = notificationRecordsStack_[n];

                    if (destinationObservableRecord) {
                        addOnce(destinationObservableRecord.sources, observableRecord);
                        addOnce(observableRecord.destinations, destinationObservableRecord);
                    }
                    if (destinationSubscriptionRecord) {
                        subscriptionRecord.destination = destinationSubscriptionRecord;
                    }
                    break;
                }
            }
        }

        notificationRecordsStack_.push({
            notification: "subscribe",
            observableRecord,
            subscriberRecord,
            subscriptionRecord
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
        const { keptValues_, observableRecordsMap_ } = this;

        this.observableRecordsMap_.forEach((o) => {

            if ((completed && o.complete) || (errored && o.error)) {
                this.observableRecordsMap_.delete(o.observable);
            } else {
                o.subscribers.forEach((s) => {
                    const count = s.values.length - keptValues_;
                    if (count > 0) {
                        s.values.splice(0, count);
                        s.valuesFlushed += count;
                    }
                });
            }
        });
    }

    snapshotAll({
        filter,
        since
    }: {
        filter?: (o: ObservableSnapshot) => boolean,
        since?: Snapshot
    } = {}): Snapshot {

        const { observableRecordsMap_, subscriberRecordsMap_ } = this;
        const subscriptionsMap = new Map<SubscriptionRef, SubscriptionRecord>();

        const observableSnapshotsMap = new Map<Observable<any>, ObservableSnapshot>();
        const subscriberSnapshotsMap = new Map<Subscriber<any>, SubscriberSnapshot>();
        const subscriptionSnapshotsMap = new Map<SubscriptionRef, SubscriptionSnapshot>();

        observableRecordsMap_.forEach((observableRecord, observable) => {

            const {
                complete,
                error,
                tag,
                tick,
                type
            } = observableRecord;

            observableSnapshotsMap.set(observable, {
                complete,
                destinations: [],
                error,
                merges: [],
                observable,
                sources: [],
                subscribers: [],
                tag,
                tick,
                type
            });
        });

        subscriberRecordsMap_.forEach((subscriberRecord, subscriber) => {

            const {
                subscriptions,
                tick,
                values,
                valuesFlushed
            } = subscriberRecord;

            subscriberSnapshotsMap.set(subscriber, {
                subscriber,
                subscriptions: [],
                tick,
                values,
                valuesFlushed
            });

            subscriptions.forEach((subscriptionRecord) => {

                const {
                    ref,
                    stackTrace,
                    timestamp
                } = subscriptionRecord;

                subscriptionsMap.set(ref, subscriptionRecord);
                subscriptionSnapshotsMap.set(ref, {
                    destination : null,
                    finalDestination: null,
                    stackTrace,
                    timestamp
                });
            });
        });

        observableSnapshotsMap.forEach((observableSnapshot, observable) => {

            const {
                destinations,
                merges,
                sources,
                subscribers
            } = observableRecordsMap_.get(observable)!;

            observableSnapshot.destinations = destinations.map((observableRecord) => observableSnapshotsMap.get(observableRecord.observable)!);
            observableSnapshot.merges = merges.map((observableRecord) => observableSnapshotsMap.get(observableRecord.observable)!);
            observableSnapshot.sources = sources.map((observableRecord) => observableSnapshotsMap.get(observableRecord.observable)!);
            observableSnapshot.subscribers = subscribers.map((subscriberRecord) => subscriberSnapshotsMap.get(subscriberRecord.subscriber)!);
        });

        subscriberSnapshotsMap.forEach((subscriberSnapshot, subscriber) => {

            const { subscriptions } = subscriberRecordsMap_.get(subscriber)!;

            subscriberSnapshot.subscriptions = subscriptions.map((subscription) => {

                const { ref } = subscription;
                const { destination } = subscriptionsMap.get(ref)!;

                const subscriptionSnapshot = subscriptionSnapshotsMap.get(ref)!;
                subscriptionSnapshot.destination = destination ? subscriptionSnapshotsMap.get(destination.ref)! : null;
                return subscriptionSnapshot;
            });
        });

        subscriptionSnapshotsMap.forEach((subscriptionSnapshot) => {

            const { destination } = subscriptionSnapshot;
            let d = destination;

            while (d) {
                subscriptionSnapshot.finalDestination = d;
                d = d.destination;
                if (d === destination) {
                    /*tslint:disable-next-line:no-console*/
                    console.warn("Circular subscribtion found.");
                    break;
                }
            }
        });

        let observables = Array.from(observableSnapshotsMap.values());

        if (filter) {
            observables = observables.filter(filter);
        }
        if (since) {
            observables = observables.filter((o) => o.tick > since.tick);
        }
        return { observables, tick: tick() };
    }

    snapshotObservable(ref: SubscriptionRef): ObservableSnapshot | null {

        const snapshot = this.snapshotAll();
        return snapshot.observables.find((o) => o.observable === ref.observable) || null;
    }

    snapshotSubscriber(ref: SubscriptionRef): SubscriberSnapshot | null {

        const observableSnapshot = this.snapshotObservable(ref);
        if (!observableSnapshot) {
            return null;
        }
        return observableSnapshot.subscribers.find((s) => s.subscriber === ref.subscriber) || null;
    }

    private push(notification: Notification, ref: SubscriptionRef): NotificationRecord {

        const notificationRecord: NotificationRecord = {
            notification,
            observableRecord: null,
            subscriberRecord: null,
            subscriptionRecord: null
        };
        const { observableRecordsMap_, notificationRecordsStack_ } = this;
        const { observable, subscriber } = ref;

        notificationRecord.observableRecord = observableRecordsMap_.get(observable) || null;
        if (notificationRecord.observableRecord) {
            notificationRecord.subscriberRecord = notificationRecord.observableRecord
                .subscribers
                .find((s) => s.subscriber === subscriber) || null;
            if (notificationRecord.subscriberRecord) {
                notificationRecord.subscriptionRecord = notificationRecord.subscriberRecord
                    .subscriptions
                    .find((s) => s.ref === ref) || null;
            }
        } else {
            /*tslint:disable-next-line:no-console*/
            console.warn("Observable Record not found; subscriptions made prior to calling 'spy' are not snapshotted.");
        }

        notificationRecordsStack_.push(notificationRecord);
        return notificationRecord;
    }
}

function addOnce<T>(array: T[], element: T): void {

    const found = array.indexOf(element);
    if (found === -1) {
        array.push(element);
    }
}

function getStackTrace(): StackFrame[] {

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

    if (typeof document !== "undefined") {
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
