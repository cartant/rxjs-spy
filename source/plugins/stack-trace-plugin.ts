/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { parse, StackFrame } from "error-stack-parser";
import { defer, Observable, of, OperatorFunction, Subscription } from "rxjs";
import { publishReplay, refCount } from "rxjs/operators";

// @ts-ignore: Could not find a declaration file for module 'stacktrace-gps'.
import * as StackTraceGps from "stacktrace-gps";

import { hide } from "../operators";
import { BasePlugin, PluginHost } from "./plugin";

const stackTraceRecordSymbol = Symbol("stackTraceRecord");

export interface StackTraceRecord {
    mappedStackTrace: Observable<StackFrame[]>;
    stackTrace: StackFrame[];
}

export class StackTracePlugin extends BasePlugin {

    private sourceCache_: object;
    private sourceMaps_: boolean;

    constructor({
        sourceMaps = false,
        pluginHost
    }: {
        sourceMaps?: boolean,
        pluginHost: PluginHost
    }) {
        super("stackTrace");
        this.sourceCache_ = {};
        this.sourceMaps_ = sourceMaps &&
            (typeof window !== "undefined") &&
            (window.location.protocol !== "file:");
    }

    beforePipe(operators: OperatorFunction<any, any>[], source: Observable<any>): void {
        const stackFrames = this.getStackFrames_();
        operators.forEach((operator, index) => {
            operators[index] = source => {
                const sink = operator(source);
                this.recordStackTrace_(sink, stackFrames);
                return sink;
            };
        });
    }

    beforeSubscribe(subscription: Subscription): void {
        const stackFrames = this.getStackFrames_();
        this.recordStackTrace_(subscription, stackFrames);
    }

    getMappedStackTrace(observable: Observable<any>): Observable<StackFrame[]>;
    getMappedStackTrace(subscription: Subscription): Observable<StackFrame[]>;
    getMappedStackTrace(arg: any): Observable<StackFrame[]> {
        const stackTraceRecord = this.getStackTraceRecord(arg);
        return stackTraceRecord ? stackTraceRecord.mappedStackTrace : of([]);
    }

    getStackTrace(observable: Observable<any>): StackFrame[];
    getStackTrace(subscription: Subscription): StackFrame[];
    getStackTrace(arg: any): StackFrame[] {
        const stackTraceRecord = this.getStackTraceRecord(arg);
        return stackTraceRecord ? stackTraceRecord.stackTrace : [];
    }

    getStackTraceRecord(observable: Observable<any>): StackTraceRecord;
    getStackTraceRecord(subscription: Subscription): StackTraceRecord;
    getStackTraceRecord(arg: any): StackTraceRecord {
        return arg[stackTraceRecordSymbol];
    }

    teardown(): void {
        this.sourceCache_ = {};
    }

    private getStackFrames_(): StackFrame[] {
        try {
            throw new Error();
        } catch (error) {
            let patched = true;
            return parse(error).filter(stackFrame => {
                const result = !patched;
                if (/patched(Lift|Pipe|Subscribe)_/.test(stackFrame.functionName || "")) {
                    patched = false;
                }
                return result;
            });
        }
    }

    private recordStackTrace_(
        target: Observable<any> | Subscription,
        stackFrames: StackFrame[]
    ): void {
        if (this.sourceMaps_) {
            this.setStackTraceRecord_(target, {
                mappedStackTrace: defer(() => {
                    const gps = new StackTraceGps({ sourceCache: this.sourceCache_ });
                    return Promise.all(stackFrames.map(stackFrame => gps
                        .pinpoint(stackFrame)
                        .catch(() => stackFrame)
                    ));
                }).pipe(
                    // Use a ReplaySubject so that callers can resolve all
                    // observables within a snapshot and can then access
                    // individual stack traces via synchronous subscribe calls.
                    publishReplay(1),
                    refCount(),
                    hide()
                ),
                stackTrace: stackFrames
            });
        } else {
            this.setStackTraceRecord_(target, {
                mappedStackTrace: of(stackFrames).pipe(hide()),
                stackTrace: stackFrames
            });
        }
    }

    private setStackTraceRecord_(target: Observable<any> | Subscription, record: StackTraceRecord): StackTraceRecord {
        target[stackTraceRecordSymbol] = record;
        return record;
    }
}
