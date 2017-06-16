/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { spy } from "../spy";
import { PatchPlugin } from "./patch-plugin";

import "../add/operator/tag";

describe("PatchPlugin", () => {

    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    it("should patch the tag's value", () => {

        const plugin = new PatchPlugin("people", "bob");
        teardown = spy({ plugins: [plugin] });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        subject.next("alice");
        expect(values).to.deep.equal(["bob"]);
    });

    it("should patch the tag's values using a project function", () => {

        const plugin = new PatchPlugin("people", (value: any) => `not ${value}`);
        teardown = spy({ plugins: [plugin] });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        subject.next("alice");
        expect(values).to.deep.equal(["not alice"]);
    });

    it("should patch the tag's source", () => {

        const patch = new Subject<string>();
        const plugin = new PatchPlugin("people", patch);
        teardown = spy({ plugins: [plugin] });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        subject.next("alice");
        expect(values).to.deep.equal([]);

        patch.next("alice");
        expect(values).to.deep.equal(["alice"]);
    });
});
