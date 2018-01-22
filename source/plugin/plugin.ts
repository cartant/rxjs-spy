/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { SubscriberRef, SubscriptionRef } from "../subscription-ref";

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
    beforeSubscribe(ref: SubscriberRef): void;
    beforeUnsubscribe(ref: SubscriptionRef): void;
    flush(): void;
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
    beforeSubscribe(ref: SubscriberRef): void {}
    beforeUnsubscribe(ref: SubscriptionRef): void {}
    flush(): void {}
    select(ref: SubscriptionRef): ((source: Observable<any>) => Observable<any>) | undefined { return undefined; }
    teardown(): void {}
}
