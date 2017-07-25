/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { getSync, StackFrame } from "stacktrace-js";
import { read } from "../match";
import { BasePlugin, Notification } from "./plugin";
import { tick } from "../spy";

export interface Snapshot {
    observables: ObservableSnapshot[];
    tick: number;
}

export interface ObservableSnapshot {
    complete: boolean;
    dependencies: ObservableSnapshot[];
    dependents: ObservableSnapshot[];
    error: any;
    merges: ObservableSnapshot[];
    observable: Observable<any>;
    subscribers: SubscriberSnapshot[];
    tag: string | null;
    tick: number;
    type: string;
}

export interface SubscriberSnapshot {
    explicit: boolean;
    stackTrace: StackFrame[];
    subscriber: Subscriber<any>;
    timestamp: number;
    values: { timestamp: number; value: any; }[];
    valuesFlushed: number;
}

interface NotificationSnapshot {
    notification: Notification;
    observableSnapshot: ObservableSnapshot | null;
    subscriberSnapshot: SubscriberSnapshot | null;
}

export class SnapshotPlugin extends BasePlugin {

    private keptValues_: number;
    private map_: Map<Observable<any>, ObservableSnapshot>;
    private stack_: NotificationSnapshot[] = [];

    constructor({ keptValues = 4 }: { keptValues?: number } = {}) {

        super();

        this.map_ = new Map<Observable<any>, ObservableSnapshot>();
        this.keptValues_ = keptValues;
    }

    afterComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { stack_ } = this;

        const notificationSnapshot = stack_.pop();
        if (notificationSnapshot) {

            const { observableSnapshot } = notificationSnapshot;
            if (observableSnapshot) {
                observableSnapshot.complete = true;
                observableSnapshot.subscribers = [];
                observableSnapshot.tick = tick();
            }
        }
    }

    afterError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {

        const { stack_ } = this;

        const notificationSnapshot = stack_.pop();
        if (notificationSnapshot) {

            const { observableSnapshot } = notificationSnapshot;
            if (observableSnapshot) {
                observableSnapshot.error = error;
                observableSnapshot.subscribers = [];
                observableSnapshot.tick = tick();
            }
        }
    }

    afterNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {

        const { stack_ } = this;
        stack_.pop();
    }

    afterSubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { stack_ } = this;
        stack_.pop();
    }

    afterUnsubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { stack_ } = this;

        const notificationSnapshot = stack_.pop();
        if (notificationSnapshot) {

            const { observableSnapshot } = notificationSnapshot;
            if (observableSnapshot) {
                observableSnapshot.subscribers = observableSnapshot
                    .subscribers
                    .filter((s) => s.subscriber !== subscriber);
            }
        }
    }

    beforeComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {

        this.push("complete", observable, subscriber);
    }

    beforeError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {

        this.push("error", observable, subscriber);
    }

    beforeNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {

        const { observableSnapshot, subscriberSnapshot } = this.push("next", observable, subscriber);
        const timestamp = Date.now();

        if (observableSnapshot) {
            observableSnapshot.tick = tick();
        }
        if (subscriberSnapshot) {
            subscriberSnapshot.timestamp = timestamp;
            subscriberSnapshot.values.push({ timestamp, value });
        }
    }

    beforeSubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        const { map_, stack_ } = this;

        let observableSnapshot = map_.get(observable);
        if (observableSnapshot) {
            observableSnapshot.tick = tick();
        } else {
            const tag = read(observable);
            observableSnapshot = {
                complete: false,
                dependencies: [],
                dependents: [],
                error: null,
                merges: [],
                observable,
                subscribers: [],
                tag,
                tick: tick(),
                type: getType(observable)
            };
            map_.set(observable, observableSnapshot);
        }

        let explicit = true;
        if ((stack_.length > 0) && (stack_[stack_.length - 1].notification === "next")) {
            explicit = false;
            const source = stack_[stack_.length - 1].observableSnapshot;
            if (source) {
                addOnce(source.merges, observableSnapshot);
            }
        } else {
            for (let s = stack_.length - 1; s > -1; --s) {
                if (stack_[s].notification === "subscribe") {
                    explicit = false;
                    const dependent = stack_[s].observableSnapshot;
                    if (dependent) {
                        addOnce(dependent.dependencies, observableSnapshot);
                        addOnce(observableSnapshot.dependents, dependent);
                    }
                    break;
                }
            }
        }

        const subscriberSnapshot: SubscriberSnapshot = {
            explicit,
            stackTrace: getStackTrace(),
            subscriber,
            timestamp: Date.now(),
            values: [],
            valuesFlushed: 0
        };
        observableSnapshot.subscribers.push(subscriberSnapshot);

        stack_.push({ notification: "subscribe", observableSnapshot, subscriberSnapshot });
    }

    beforeUnsubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {

        this.push("unsubscribe", observable, subscriber);
    }

    flush(options?: {
        completed?: boolean,
        errored?: boolean
    }): void {

        const { completed, errored } = options || {
            completed: true,
            errored: true
        };
        const { keptValues_, map_ } = this;

        this.map_.forEach((o) => {

            if ((completed && o.complete) || (errored && o.error)) {
                this.map_.delete(o.observable);
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

    peekAtObservable(observable: Observable<any>): ObservableSnapshot | null {

        const { map_ } = this;
        return map_.get(observable) || null;
    }

    peekAtSubscriber(observable: Observable<any>, subscriber: Subscriber<any>): SubscriberSnapshot | null {

        const { map_ } = this;

        let observableSnapshot = map_.get(observable);
        if (!observableSnapshot) {
            return null;
        }
        return observableSnapshot.subscribers.find((s) => s.subscriber === subscriber) || null;
    }

    snapshot({
        filter,
        since
    }: {
        filter?: (o: ObservableSnapshot) => boolean,
        since?: Snapshot
    } = {}): Snapshot {

        let observables = Array.from(this.map_.values()).map(clone);
        observables.forEach((o) => {
            o.dependencies = o.dependencies.map(findClone);
            o.dependents = o.dependents.map(findClone);
            o.merges = o.merges.map(findClone);
        });

        if (filter) {
            observables = observables.filter(filter);
        }
        if (since) {
            observables = observables.filter((o) => o.tick > since.tick);
        }
        return { observables, tick: tick() };

        function clone(o: ObservableSnapshot): ObservableSnapshot {
            return { ...o, subscribers: o.subscribers.map((s) => ({ ...s })) };
        }

        function findClone(o: ObservableSnapshot): ObservableSnapshot {
            return observables.find((clone) => clone.observable === o.observable) as ObservableSnapshot;
        }
    }

    private push(notification: Notification, observable: Observable<any>, subscriber: Subscriber<any>): NotificationSnapshot {

        const notificationSnapshot: NotificationSnapshot = {
            notification,
            observableSnapshot: null,
            subscriberSnapshot: null
        };
        const { map_, stack_ } = this;

        notificationSnapshot.observableSnapshot = map_.get(observable) || null;
        if (notificationSnapshot.observableSnapshot) {
            notificationSnapshot.subscriberSnapshot = notificationSnapshot.observableSnapshot
                .subscribers
                .find((s) => s.subscriber === subscriber) || null;
        } else {
            /*tslint:disable-next-line:no-console*/
            console.warn("Observable snapshot not found; subscriptions made prior to calling 'spy' are not snapshotted.");
        }

        stack_.push(notificationSnapshot);
        return notificationSnapshot;
    }
}

function addOnce<T>(array: T[], element: T): void {

    const found = array.indexOf(element);
    if (found === -1) {
        array.push(element);
    }
}

function getStackTrace(): StackFrame[] {

    let preSubscribeWithSpy = false;

    return getSync({
        filter: (stackFrame) => {
            const result = preSubscribeWithSpy;
            if (/subscribeWithSpy/.test(stackFrame.functionName)) {
                preSubscribeWithSpy = true;
            }
            return result;
        }
    });
}

function getType(observable: Observable<any>): string {

    const prototype = Object.getPrototypeOf(observable);
    if (prototype.constructor && prototype.constructor.name) {
        return prototype.constructor.name;
    }
    return "Object";
}

function noSnapshot(): void {

    /*tslint:disable-next-line:no-console*/
    console.warn("Snapshot not found; subscriptions made prior to calling 'spy' are not snapshotted.");
}
