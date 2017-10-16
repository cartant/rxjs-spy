/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { get, getSync, StackFrame } from "stacktrace-js";
import { BasePlugin, SubscriptionRef } from "./plugin";

const stackTraceSymbol = Symbol("stackTrace");

export function getStackTrace(ref: SubscriptionRef): StackFrame[] {

    return ref[stackTraceSymbol];
}

function setStackTrace(ref: SubscriptionRef, value: StackFrame[]): StackFrame[] {

    ref[stackTraceSymbol] = value;
    return value;
}

export class StackTracePlugin extends BasePlugin {

    beforeSubscribe(ref: SubscriptionRef): void {

        const stackFrames = getSync(options());
        setStackTrace(ref, stackFrames);

        if ((typeof window !== "undefined") && (window.location.protocol !== "file:")) {
            get(options()).then((sourceMappedFrames) => {
                stackFrames.splice(0, stackFrames.length, ...sourceMappedFrames);
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
