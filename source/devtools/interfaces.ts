/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export interface Connection {
    disconnect(): void;
    post(message: Message): Post;
    subscribe(next: (message: Post) => void): { unsubscribe(): void };
}

export interface DeckStats {
    id: string;
    notifications: number;
    paused: boolean;
}

export interface Extension {
    connect(options: { version: string }): Connection;
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
    [key: string]: any;
    messageType: string;
}

export interface Batch extends Message {
    [key: string]: any;
    messages: Message[];
    messageType: "batch";
}

export interface Broadcast extends Message {
    [key: string]: any;
    broadcastType: string;
    messageType: "broadcast";
}

export interface Notification {
    id: string;
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
    type: string;
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

export interface Post extends Message {
    [key: string]: any;
    postId: string;
    postType: string;
}

export interface Request extends Message {
    [key: string]: any;
    messageType: "request";
    requestType: string;
}

export interface Response extends Message {
    [key: string]: any;
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
