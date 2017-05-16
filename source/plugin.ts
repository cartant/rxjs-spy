/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";

export interface Plugin {

    afterComplete: (observable: Observable<any>, subscriber: Subscriber<any>) => void;
    afterError: (observable: Observable<any>, subscriber: Subscriber<any>, error: any) => void;
    afterNext: (observable: Observable<any>, subscriber: Subscriber<any>, value: any) => void;
    afterSubscribe: (observable: Observable<any>, subscriber: Subscriber<any>) => void;
    afterUnsubscribe: (observable: Observable<any>, subscriber: Subscriber<any>) => void;
    beforeComplete: (observable: Observable<any>, subscriber: Subscriber<any>) => void;
    beforeError: (observable: Observable<any>, subscriber: Subscriber<any>, error: any) => void;
    beforeNext: (observable: Observable<any>, subscriber: Subscriber<any>, value: any) => void;
    beforeSubscribe: (observable: Observable<any>, subscriber: Subscriber<any>) => void;
    beforeUnsubscribe: (observable: Observable<any>, subscriber: Subscriber<any>) => void;
    overrideMatch?: (observable: Observable<any>) => boolean;
    overrideObservable?: (observable: Observable<any>, subscriber: Subscriber<any>) => Observable<any>;
    overrideValue?: (observable: Observable<any>, subscriber: Subscriber<any>, value: any) => any;
}

export function emptyPlugin(): Plugin {

    return {
        afterComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {},
        afterError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {},
        afterNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {},
        afterSubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {},
        afterUnsubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {},
        beforeComplete(observable: Observable<any>, subscriber: Subscriber<any>): void {},
        beforeError(observable: Observable<any>, subscriber: Subscriber<any>, error: any): void {},
        beforeNext(observable: Observable<any>, subscriber: Subscriber<any>, value: any): void {},
        beforeSubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {},
        beforeUnsubscribe(observable: Observable<any>, subscriber: Subscriber<any>): void {}
    };
}
