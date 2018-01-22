/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { LetPlugin } from "./let-plugin";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";

import "rxjs/add/observable/of";
import "../add/operator/tag";

describe("LetPlugin", () => {

    let spy: Spy;

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });

    it("should apply the selector to a tag's source", () => {

        const selected = new Subject<string>();
        const plugin = new LetPlugin("people", () => selected);

        spy = create({ defaultPlugins: false, warning: false });
        spy.plug(plugin);

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        subject.next("alice");
        expect(values).to.deep.equal([]);

        selected.next("alice");
        expect(values).to.deep.equal(["alice"]);
    });

    it("should apply the selector to an already-subscribed tag's source", () => {

        spy = create({ defaultPlugins: false, warning: false });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        const selected = new Subject<string>();
        spy.plug(new LetPlugin("people", () => selected));

        subject.next("alice");
        expect(values).to.deep.equal([]);

        selected.next("alice");
        expect(values).to.deep.equal(["alice"]);
    });

    it("should forward completion notifications from the selected source by default", () => {

        spy = create({ defaultPlugins: false, warning: false });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        const selected = new Subject<string>();
        spy.plug(new LetPlugin("people", () => Observable.of("bob")));

        subject.next("alice");
        expect(values).to.deep.equal(["bob"]);
        expect(subscription).to.have.property("closed", true);
    });

    it("should ignore completion notifications from the selected source if required", () => {

        spy = create({ defaultPlugins: false, warning: false });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.tag("people").subscribe((value) => values.push(value));

        const selected = new Subject<string>();
        spy.plug(new LetPlugin("people", () => Observable.of("bob"), { complete: false }));

        subject.next("alice");
        expect(values).to.deep.equal(["bob"]);
        expect(subscription).to.have.property("closed", false);
    });
});
