/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { parse, StackFrame } from "error-stack-parser";
import { defer, Observable, of, Subscription } from "rxjs";
import { shareReplay } from "rxjs/operators";

// @ts-ignore: Could not find a declaration file for module 'stacktrace-gps'.
import * as StackTraceGps from "stacktrace-gps";

import { hide } from "../operators";
import { Spy } from "../spy-interface";
import { BasePlugin } from "./plugin";

const stackTraceRefSymbol = Symbol("stackTraceRef");

export interface StackTraceRef {
    mappedStackTrace: Observable<StackFrame[]>;
    stackTrace: StackFrame[];
}

export function getMappedStackTrace(subscription: Subscription): Observable<StackFrame[]> {

    const stackTraceRef = getStackTraceRef(subscription);
    return stackTraceRef ? stackTraceRef.mappedStackTrace : of([]);
}

export function getStackTrace(subscription: Subscription): StackFrame[] {

    const stackTraceRef = getStackTraceRef(subscription);
    return stackTraceRef ? stackTraceRef.stackTrace : [];
}

export function getStackTraceRef(subscription: Subscription): StackTraceRef {

    return subscription[stackTraceRefSymbol];
}

function setStackTraceRef(subscription: Subscription, value: StackTraceRef): StackTraceRef {

    subscription[stackTraceRefSymbol] = value;
    return value;
}

export class StackTracePlugin extends BasePlugin {

    private sourceCache_: object;
    private sourceMaps_: boolean;

    constructor({
        sourceMaps = false,
        spy
    }: {
        sourceMaps?: boolean,
        spy: Spy
    }) {

        super("stackTrace");

        this.sourceCache_ = {};
        this.sourceMaps_ = sourceMaps;
    }

    beforeSubscribe(subscription: Subscription): void {

        const stackFrames = this.getStackFrames_();

        if (this.sourceMaps_ && (typeof window !== "undefined") && (window.location.protocol !== "file:")) {
            setStackTraceRef(subscription, {
                mappedStackTrace: defer(() => {
                    const gps = new StackTraceGps({ sourceCache: this.sourceCache_ });
                    return Promise.all(stackFrames.map(stackFrame => gps
                        .pinpoint(stackFrame)
                        .catch(() => stackFrame)
                    ));
                }).pipe(
                    shareReplay(1),
                    hide()
                ),
                stackTrace: stackFrames
            });
        } else {
            setStackTraceRef(subscription, {
                mappedStackTrace: of(stackFrames).pipe(hide()),
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
