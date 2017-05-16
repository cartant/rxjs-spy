/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Overrider } from "./overrider";

import "./add/operator/tag";

describe("overrider", () => {

    describe("overrideObservable", () => {

        it("should override an observable subscription", () => {

            const override = new Subject<string>();
            const overrider = new Overrider("people");
            overrider.overrideObservable((observable) => override);

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            expect(values).to.deep.equal([]);

            override.next("alice");
            expect(values).to.deep.equal(["alice"]);

            overrider.detach();
        });
    });

    describe("overrideValue", () => {

        it("should override a value", () => {

            const overrider = new Overrider("people");
            overrider.overrideValue((value) => "bob");

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            expect(values).to.deep.equal(["bob"]);

            overrider.detach();
        });
    });
});
