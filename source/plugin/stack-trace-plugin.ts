/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { parse, StackFrame } from "error-stack-parser";
import { Observable } from "rxjs/Observable";
import { defer } from "rxjs/observable/defer";
import { of } from "rxjs/observable/of";
import { shareReplay } from "rxjs/operator/shareReplay";

// @ts-ignore: Could not find a declaration file for module 'stacktrace-gps'.
import * as StackTraceGps from "stacktrace-gps";

import { hide } from "../operator/hide";
import { BasePlugin } from "./plugin";
import { SubscriberRef, SubscriptionRef } from "../subscription-ref";

const stackTraceRefSymbol = Symbol("stackTraceRef");

export interface StackTraceRef {
    mappedStackTrace: Observable<StackFrame[]>;
    stackTrace: StackFrame[];
}

export function getMappedStackTrace(ref: SubscriberRef): Observable<StackFrame[]> {

    const stackTraceRef = getStackTraceRef(ref);
    return stackTraceRef ? stackTraceRef.mappedStackTrace : of([]);
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

    private sourceCache_: object;
    private sourceMaps_: boolean;

    constructor({ sourceMaps = false }: { sourceMaps?: boolean } = {}) {

        super("stackTrace");

        this.sourceCache_ = {};
        this.sourceMaps_ = sourceMaps;
    }

    beforeSubscribe(ref: SubscriberRef): void {

        const stackFrames = this.getStackFrames_();

        if (this.sourceMaps_ && (typeof window !== "undefined") && (window.location.protocol !== "file:")) {
            setStackTraceRef(ref, {
                mappedStackTrace: hide.call(shareReplay.call(defer(() => {
                    const gps = new StackTraceGps({ sourceCache: this.sourceCache_ });
                    return Promise.all(stackFrames.map(stackFrame => gps
                        .pinpoint(stackFrame)
                        .catch(() => stackFrame)
                    ));
                }), 1)),
                stackTrace: stackFrames
            });
        } else {
            setStackTraceRef(ref, {
                mappedStackTrace: hide.call(of(stackFrames)),
                stackTrace: stackFrames
            });
        }
    }

    teardown(): void {

        this.sourceCache_ = {};
    }

    private getStackFrames_(): StackFrame[] {

        try {
            throw new Error();
        } catch (error) {
            let core = true;
            return parse(error).filter(stackFrame => {
                const result = !core;
                if (/coreSubscribe_/.test(stackFrame.functionName || "")) {
                    core = false;
                }
                return result;
            });
        }
    }
}
