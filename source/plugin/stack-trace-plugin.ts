/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:rxjs-no-sharereplay*/

import { parse, StackFrame } from "error-stack-parser";
import { defer, Observable, of } from "rxjs";
import { shareReplay } from "rxjs/operators";

// @ts-ignore: Could not find a declaration file for module 'stacktrace-gps'.
import * as StackTraceGps from "stacktrace-gps";

import { hide } from "../operators";
import { SubscriberRef } from "../subscription-ref";
import { BasePlugin } from "./plugin";

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
            setStackTraceRef(ref, {
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
