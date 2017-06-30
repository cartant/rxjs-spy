/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { LetPlugin } from "./let-plugin";
import { plugin, spy } from "../spy";

import "../add/operator/tag";

describe("LetPlugin", () => {

    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    it("should apply the selector to a tag's source", () => {

        const selected = new Subject<string>();
        const plugin = new LetPlugin("people", () => selected);
        teardown = spy({ plugins: [plugin] });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        subject.next("alice");
        expect(values).to.deep.equal([]);

        selected.next("alice");
        expect(values).to.deep.equal(["alice"]);
    });

    it("should apply the selector to an already-subscribed tag's source", () => {

        teardown = spy({ plugins: [] });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        const selected = new Subject<string>();
        plugin(new LetPlugin("people", () => selected), "let");

        subject.next("alice");
        expect(values).to.deep.equal([]);

        selected.next("alice");
        expect(values).to.deep.equal(["alice"]);
    });
});
