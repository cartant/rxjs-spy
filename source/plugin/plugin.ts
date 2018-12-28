/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Operator, OperatorFunction, Subscription } from "rxjs";
import { Spy } from "../spy-interface";

export type Notification = "complete" | "error" | "next" | "subscribe" | "unsubscribe";

export interface PluginOptions {
    [key: string]: any;
    spy: Spy;
}
export type PluginCtor<P extends Plugin, O extends PluginOptions> = new (options: O) => P;

export interface Plugin {

    readonly name: string;

    afterComplete(subscription: Subscription): void;
    afterError(subscription: Subscription, error: any): void;
    afterLift(operator: Operator<any, any>, source: Observable<any>, sink: Observable<any>): void;
    afterNext(subscription: Subscription, value: any): void;
    afterPipe(operators: OperatorFunction<any, any>[], source: Observable<any>, sink: Observable<any>): void;
    afterSubscribe(subscription: Subscription): void;
    afterUnsubscribe(subscription: Subscription): void;
    beforeComplete(subscription: Subscription): void;
    beforeError(subscription: Subscription, error: any): void;
    beforeLift(operator: Operator<any, any>, source: Observable<any>): void;
    beforeNext(subscription: Subscription, value: any): void;
    beforePipe(operators: OperatorFunction<any, any>[], source: Observable<any>): void;
    beforeSubscribe(subscription: Subscription): void;
    beforeUnsubscribe(subscription: Subscription): void;
    operator(subscription: Subscription): ((source: Observable<any>) => Observable<any>) | undefined;
    teardown(): void;
}

export class BasePlugin implements Plugin {

    constructor(public readonly name: string) {}

    afterComplete(subscription: Subscription): void {}
    afterError(subscription: Subscription, error: any): void {}
    afterLift(operator: Operator<any, any>, source: Observable<any>, sink: Observable<any>): void {}
    afterNext(subscription: Subscription, value: any): void {}
    afterPipe(operators: OperatorFunction<any, any>[], source: Observable<any>, sink: Observable<any>): void {}
    afterSubscribe(subscription: Subscription): void {}
    afterUnsubscribe(subscription: Subscription): void {}
    beforeComplete(subscription: Subscription): void {}
    beforeError(subscription: Subscription, error: any): void {}
    beforeLift(operator: Operator<any, any>, source: Observable<any>): void {}
    beforeNext(subscription: Subscription, value: any): void {}
    beforePipe(operators: OperatorFunction<any, any>[], source: Observable<any>): void {}
    beforeSubscribe(subscription: Subscription): void {}
    beforeUnsubscribe(subscription: Subscription): void {}
    operator(subscription: Subscription): ((source: Observable<any>) => Observable<any>) | undefined { return undefined; }
    teardown(): void {}
}
