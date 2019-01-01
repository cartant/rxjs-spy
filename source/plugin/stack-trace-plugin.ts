/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { parse, StackFrame } from "error-stack-parser";
import { defer, Observable, of, ReplaySubject, Subscription } from "rxjs";
import { multicast, refCount } from "rxjs/operators";

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
        this.sourceMaps_ = sourceMaps;
    }

    beforeSubscribe(subscription: Subscription): void {

        const stackFrames = this.getStackFrames_();

        if (this.sourceMaps_ && (typeof window !== "undefined") && (window.location.protocol !== "file:")) {
            this.setStackTraceRecord_(subscription, {
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
                    multicast(() => new ReplaySubject(1)),
                    refCount(),
                    hide()
                ),
                stackTrace: stackFrames
            });
        } else {
            this.setStackTraceRecord_(subscription, {
                mappedStackTrace: of(stackFrames).pipe(hide()),
                stackTrace: stackFrames
            });
        }
    }

    getMappedStackTrace(subscription: Subscription): Observable<StackFrame[]> {

        const stackTraceRecord = this.getStackTraceRecord(subscription);
        return stackTraceRecord ? stackTraceRecord.mappedStackTrace : of([]);
    }

    getStackTrace(subscription: Subscription): StackFrame[] {

        const stackTraceRecord = this.getStackTraceRecord(subscription);
        return stackTraceRecord ? stackTraceRecord.stackTrace : [];
    }

    getStackTraceRecord(subscription: Subscription): StackTraceRecord {

        return subscription[stackTraceRecordSymbol];
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

    private setStackTraceRecord_(subscription: Subscription, record: StackTraceRecord): StackTraceRecord {

        subscription[stackTraceRecordSymbol] = record;
        return record;
    }
}
