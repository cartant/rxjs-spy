/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { get, getSync, StackFrame } from "stacktrace-js";
import { BasePlugin, SubscriberRef, SubscriptionRef } from "./plugin";

const stackTraceRefSymbol = Symbol("stackTraceRef");

export interface StackTraceRef {
    sourceMapsResolved: Promise<void>;
    stackTrace: StackFrame[];
}

export function getStackTrace(ref: SubscriberRef): StackFrame[] {

    const stackTraceRef = getStackTraceRef(ref);
    return stackTraceRef ? stackTraceRef.stackTrace : [];
}

export function getStackTraceRef(ref: SubscriberRef): StackTraceRef {

    return ref[stackTraceRefSymbol];
}

function setStackTraceRef(ref: SubscriberRef, value: StackTraceRef): StackTraceRef {

    ref[stackTraceRefSymbol] = value;
    return value;
}

export class StackTracePlugin extends BasePlugin {

    private sourceMaps_: boolean;

    constructor({ sourceMaps = false }: { sourceMaps?: boolean } = {}) {

        super();
        this.sourceMaps_ = sourceMaps;
    }

    beforeSubscribe(ref: SubscriberRef): void {

        const stackTraceRef: StackTraceRef = {
            sourceMapsResolved: Promise.resolve(),
            stackTrace: getSync(options())
        };
        setStackTraceRef(ref, stackTraceRef);

        if (this.sourceMaps_ && (typeof window !== "undefined") && (window.location.protocol !== "file:")) {
            stackTraceRef.sourceMapsResolved = get(options()).then((stackFrames) => {
                const { stackTrace } = stackTraceRef;
                stackTrace.splice(0, stackTrace.length, ...stackFrames);
            });
        }
    }
}

function options(): any {

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
}
