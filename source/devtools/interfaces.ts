/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { EXTENSION_KEY } from "./constants";

export interface Connection {
    disconnect(): void;
    post(message: Message): Post;
    subscribe(next: (message: Post) => void): { unsubscribe(): void };
}

export interface Extension {
    connect(): Connection;
}

export interface Graph {
    flattenings: string[];
    flatteningsFlushed: number;
    rootSink: string | null;
    sink: string | null;
    sources: string[];
    sourcesFlushed: number;
}

export interface Message {
    messageType: string;
}

export interface Notification extends Message {
    id: string;
    messageType: "notification";
    notification: string;
    observable: {
        id: string;
        path: string;
        tag: string | null;
        type: string;
    };
    subscriber: {
        id: string;
    };
    subscription: {
        error?: any;
        graph: Graph | null;
        id: string;
        stackTrace: StackFrame[] | null;
    };
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

export interface Post extends Message {
    postId: string;
    postType: string;
}

export interface Request extends Message {
    messageType: "request";
    requestType: string;
}

export interface Response extends Message {
    error?: string;
    messageType: "response";
    request: Post & Request;
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
    complete: boolean;
    error?: any;
    graph: Graph | null;
    id: string;
    observable: string;
    stackTrace: StackFrame[];
    subscriber: string;
    tick: number;
    timestamp: number;
    unsubscribed: boolean;
}
