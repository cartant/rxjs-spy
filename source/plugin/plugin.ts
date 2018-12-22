/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Subscriber, Subscription } from "rxjs";
import { SubscriptionRef } from "../subscription-ref";

export type Notification = "complete" | "error" | "next" | "subscribe" | "unsubscribe";

export interface Plugin {

    readonly name: string;

    afterComplete(ref: SubscriptionRef): void;
    afterError(ref: SubscriptionRef, error: any): void;
    afterNext(ref: SubscriptionRef, value: any): void;
    afterSubscribe(ref: SubscriptionRef): void;
    afterUnsubscribe(ref: SubscriptionRef): void;
    beforeComplete(ref: SubscriptionRef): void;
    beforeError(ref: SubscriptionRef, error: any): void;
    beforeNext(ref: SubscriptionRef, value: any): void;
    beforeSubscribe(ref: SubscriptionRef): void;
    beforeUnsubscribe(ref: SubscriptionRef): void;
    select(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | undefined;
    teardown(): void;
}

export class BasePlugin implements Plugin {

    constructor(public readonly name: string) {}

    afterComplete(ref: SubscriptionRef): void {}
    afterError(ref: SubscriptionRef, error: any): void {}
    afterNext(ref: SubscriptionRef, value: any): void {}
    afterSubscribe(ref: SubscriptionRef): void {}
    afterUnsubscribe(ref: SubscriptionRef): void {}
    beforeComplete(ref: SubscriptionRef): void {}
    beforeError(ref: SubscriptionRef, error: any): void {}
    beforeNext(ref: SubscriptionRef, value: any): void {}
    beforeSubscribe(ref: SubscriptionRef): void {}
    beforeUnsubscribe(ref: SubscriptionRef): void {}
    select(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | undefined { return undefined; }
    teardown(): void {}
}
