/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Operator, OperatorFunction } from "rxjs";
import { Spy } from "../spy-interface";
import { SubscriptionRef } from "../subscription-ref";

export type Notification = "complete" | "error" | "next" | "subscribe" | "unsubscribe";

export interface PluginOptions {
    [key: string]: any;
    spy: Spy;
}
export type PluginCtor<P extends Plugin, O extends PluginOptions> = new (options: O) => P;

export interface Plugin {

    readonly name: string;

    afterComplete(ref: SubscriptionRef): void;
    afterError(ref: SubscriptionRef, error: any): void;
    afterLift(operator: Operator<any, any>, source: Observable<any>, sink: Observable<any>): void;
    afterNext(ref: SubscriptionRef, value: any): void;
    afterPipe(operators: OperatorFunction<any, any>[], source: Observable<any>, sink: Observable<any>): void;
    afterSubscribe(ref: SubscriptionRef): void;
    afterUnsubscribe(ref: SubscriptionRef): void;
    beforeComplete(ref: SubscriptionRef): void;
    beforeError(ref: SubscriptionRef, error: any): void;
    beforeLift(operator: Operator<any, any>, source: Observable<any>): void;
    beforeNext(ref: SubscriptionRef, value: any): void;
    beforePipe(operators: OperatorFunction<any, any>[], source: Observable<any>): void;
    beforeSubscribe(ref: SubscriptionRef): void;
    beforeUnsubscribe(ref: SubscriptionRef): void;
    operator(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | undefined;
    teardown(): void;
}

export class BasePlugin implements Plugin {

    constructor(public readonly name: string) {}

    afterComplete(ref: SubscriptionRef): void {}
    afterError(ref: SubscriptionRef, error: any): void {}
    afterLift(operator: Operator<any, any>, source: Observable<any>, sink: Observable<any>): void {}
    afterNext(ref: SubscriptionRef, value: any): void {}
    afterPipe(operators: OperatorFunction<any, any>[], source: Observable<any>, sink: Observable<any>): void {}
    afterSubscribe(ref: SubscriptionRef): void {}
    afterUnsubscribe(ref: SubscriptionRef): void {}
    beforeComplete(ref: SubscriptionRef): void {}
    beforeError(ref: SubscriptionRef, error: any): void {}
    beforeLift(operator: Operator<any, any>, source: Observable<any>): void {}
    beforeNext(ref: SubscriptionRef, value: any): void {}
    beforePipe(operators: OperatorFunction<any, any>[], source: Observable<any>): void {}
    beforeSubscribe(ref: SubscriptionRef): void {}
    beforeUnsubscribe(ref: SubscriptionRef): void {}
    operator(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | undefined { return undefined; }
    teardown(): void {}
}
