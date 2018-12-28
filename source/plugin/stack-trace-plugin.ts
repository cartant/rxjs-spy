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

const stackTraceLabelSymbol = Symbol("stackTraceLabel");

export interface StackTraceLabel {
    mappedStackTrace: Observable<StackFrame[]>;
    stackTrace: StackFrame[];
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
            this.setStackTraceLabel_(subscription, {
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
            this.setStackTraceLabel_(subscription, {
                mappedStackTrace: of(stackFrames).pipe(hide()),
                stackTrace: stackFrames
            });
        }
    }

    getMappedStackTrace(subscription: Subscription): Observable<StackFrame[]> {

        const stackTraceLabel = this.getStackTraceLabel(subscription);
        return stackTraceLabel ? stackTraceLabel.mappedStackTrace : of([]);
    }

    getStackTrace(subscription: Subscription): StackFrame[] {

        const stackTraceLabel = this.getStackTraceLabel(subscription);
        return stackTraceLabel ? stackTraceLabel.stackTrace : [];
    }

    getStackTraceLabel(subscription: Subscription): StackTraceLabel {

        return subscription[stackTraceLabelSymbol];
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

    private setStackTraceLabel_(subscription: Subscription, label: StackTraceLabel): StackTraceLabel {

        subscription[stackTraceLabelSymbol] = label;
        return label;
    }
}
