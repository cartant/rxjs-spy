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
    type: string;
}

export function getSourceMapsResolved(ref: SubscriberRef): Promise<void> {

    const stackTraceRef = getStackTraceRef(ref);
    return stackTraceRef ? stackTraceRef.sourceMapsResolved : Promise.resolve();
}

export function getStackTrace(ref: SubscriberRef): StackFrame[] {

    const stackTraceRef = getStackTraceRef(ref);
    return stackTraceRef ? stackTraceRef.stackTrace : [];
}

export function getStackTraceRef(ref: SubscriberRef): StackTraceRef {

    return ref[stackTraceRefSymbol];
}

export function getType(ref: SubscriberRef): string {

    const stackTraceRef = getStackTraceRef(ref);
    return stackTraceRef ? stackTraceRef.type : inferType(ref, []);
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
            stackTrace: getSync(options()),
            type: inferType(ref, [])
        };
        setStackTraceRef(ref, stackTraceRef);

        if (this.sourceMaps_ && (typeof window !== "undefined") && (window.location.protocol !== "file:")) {
            stackTraceRef.sourceMapsResolved = get(options())
                .then((stackFrames) => {
                    const { stackTrace } = stackTraceRef;
                    stackTrace.splice(0, stackTrace.length, ...stackFrames);
                    stackTraceRef.type = inferType(ref, stackTrace);
                })
                /*tslint:disable-next-line:no-console*/
                .catch((error) => console.error("Cannot resolve source maps", error));
        }
    }
}

function inferType(ref: SubscriberRef, stackTrace: StackFrame[]): string {

    // TODO: Infer the friendliest possible type name for the observable from
    // the prototype and the stack trace.

    const prototype = Object.getPrototypeOf(ref.observable);
    if (prototype.constructor && prototype.constructor.name) {
        return prototype.constructor.name;
    }
    return "Object";
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
