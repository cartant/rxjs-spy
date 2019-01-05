/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { StackFrame } from "error-stack-parser";
import { Observable, Subscriber, Subscription } from "rxjs";
import { QueryRecord } from "../query";

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
    id: string;
    inner: boolean;
    inners: Map<Subscription, SubscriptionSnapshot>;
    innersFlushed: number;
    mappedStackTrace: Observable<StackFrame[]>;
    nextCount: number;
    nextTimestamp: number;
    observable: Observable<any>;
    queryRecord: QueryRecord;
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
