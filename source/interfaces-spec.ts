/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { inferType, SubscriberRef } from "./interfaces";

import "rxjs/add/observable/interval";
import "rxjs/add/operator/mapTo";

describe("interfaces", () => {

    describe("inferType", () => {

        it("should infer an observable's type", () => {

            const source = Observable.interval(1000);
            expect(inferType(mockRef(source))).to.equal("interval");
        });

        it("should infer an operator's type", () => {

            const source = Observable.interval(1000).mapTo(0);
            expect(inferType(mockRef(source))).to.equal("mapTo");
        });

        it("should infer a subject's type", () => {

            const source = new Subject<number>();
            expect(inferType(mockRef(source))).to.equal("Subject");
        });
    });
});

function mockRef(observable: Observable<any>): SubscriberRef {

    return {
        observable,
        subscriber: undefined!,
        timestamp: Date.now(),
        unsubscribed: false
    };
}
