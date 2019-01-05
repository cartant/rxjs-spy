/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Operator, OperatorFunction, Subscription } from "rxjs";
import { Auditor } from "../auditor";
import { Logger } from "../logger";
import { Teardown } from "../teardown";

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
    getOperator(subscription: Subscription): ((source: Observable<any>) => Observable<any>) | undefined;
    teardown(): void;
}

export interface PluginHost {
    readonly auditor: Auditor;
    readonly logger: Logger;
    readonly tick: number;
    readonly version: string;
    findPlugins<P extends Plugin, O extends PluginOptions>(ctor: PluginCtor<P, O>, dependent?: PluginCtor<any, any>): P[];
    notifyPlugins<T = void>(options: {
        before?: () => void,
        beforeEach: (plugin: Plugin) => void,
        between: () => T,
        afterEach: (plugin: Plugin, result: T) => void,
        after?: () => void
    }): T;
    plug(...plugins: Plugin[]): Teardown;
    unplug(...plugins: Plugin[]): void;
}

export interface PluginOptions {
    [key: string]: any;
    pluginHost: PluginHost;
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
    getOperator(subscription: Subscription): ((source: Observable<any>) => Observable<any>) | undefined { return undefined; }
    teardown(): void {}
}
