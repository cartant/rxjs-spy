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
    merges: string[];
    mergesFlushed: number;
    rootSink: string | null;
    sink: string | null;
    sources: string[];
    sourcesFlushed: number;
}

export interface Message {
    messageType: string;
}

export interface Notification extends Message {
    error?: any;
    graph: Graph | null;
    messageType: "notification";
    notification: string;
    observableId: string;
    stackTrace: StackFrame[] | null;
    subscriberId: string;
    subscriptionId: string;
    tag: string | null;
    type: string;
    value?: any;
}

export interface Post extends Message {
    postId: string;
    postType: string;
}

export interface Request extends Message {
    messageType: "request";
}

export interface Response extends Message {
    messageType: "response";
    request: Post;
}

export interface StackFrame {
    columnNumber: number;
    fileName: string;
    functionName: string;
    isEval: boolean;
    isNative: boolean;
    lineNumber: number;
    source: string;
}
