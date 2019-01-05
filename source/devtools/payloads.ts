/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export interface DeckStats {
    id: string;
    notifications: number;
    paused: boolean;
}

export interface Graph {
    inners: string[];
    innersFlushed: number;
    rootSink: string | null;
    sink: string | null;
    sources: string[];
    sourcesFlushed: number;
}

export interface Notification {
    error?: any;
    graph: Graph | null;
    notificationId: string;
    notificationType: string;
    observableId: string;
    observablePath: string;
    observableType: string;
    subscriberId: string;
    subscriptionId: string;
    subscriptionStackTrace: StackFrame[] | null;
    tag: string | null;
    tick: number;
    timestamp: number;
    value?: { json: string };
}

export interface ObservableSnapshot {
    id: string;
    path: string;
    subscriptions: string[];
    tag: string | null;
    tick: number;
    type: string;
}

export interface Paused {
    id: string;
    notifications: number;
    subscriptions: number;
}

export interface Snapshot {
    observables: ObservableSnapshot[];
    subscribers: SubscriberSnapshot[];
    subscriptions: SubscriptionSnapshot[];
    tick: number;
}

export interface StackFrame {
    columnNumber: number;
    fileName: string;
    functionName: string;
    lineNumber: number;
    source: string;
}

export interface SubscriberSnapshot {
    id: string;
    subscriptions: string[];
    tick: number;
    values: { tick: number; timestamp: number; value: { json: string }; }[];
    valuesFlushed: number;
}

export interface SubscriptionSnapshot {
    completeTimestamp: number;
    error?: any;
    errorTimestamp: number;
    graph: Graph | null;
    id: string;
    nextCount: number;
    nextTimestamp: number;
    observable: string;
    queryRecord: Record<string, any>;
    stackTrace: StackFrame[];
    subscribeTimestamp: number;
    subscriber: string;
    tick: number;
    unsubscribeTimestamp: number;
    values: { tick: number; timestamp: number; value: { json: string }; }[];
    valuesFlushed: number;
}
