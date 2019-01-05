/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { of, Subject } from "rxjs";
import { create } from "../factory";
import { tag } from "../operators";
import { Spy } from "../spy";
import { PipePlugin } from "./pipe-plugin";

describe("PipePlugin", () => {

    let spy: Spy;

    it("should apply the operator to a tag's source", () => {

        const operated = new Subject<string>();

        spy = create({ defaultPlugins: false, warning: false });
        const plugin = new PipePlugin({
            match: "people",
            operator: () => operated,
            pluginHost: spy.pluginHost
        });
        spy.pluginHost.plug(plugin);

        const values: any[] = [];
        const subject = new Subject<string>();
        subject.pipe(tag("people")).subscribe(value => values.push(value));

        subject.next("alice");
        expect(values).to.deep.equal([]);

        operated.next("alice");
        expect(values).to.deep.equal(["alice"]);
    });

    it("should apply the operator to an already-subscribed tag's source", () => {

        spy = create({ defaultPlugins: false, warning: false });

        const values: any[] = [];
        const subject = new Subject<string>();
        subject.pipe(tag("people")).subscribe(value => values.push(value));

        const operated = new Subject<string>();
        spy.pluginHost.plug(new PipePlugin({
            match: "people",
            operator: () => operated,
            pluginHost: spy.pluginHost
        }));

        subject.next("alice");
        expect(values).to.deep.equal([]);

        operated.next("alice");
        expect(values).to.deep.equal(["alice"]);
    });

    it("should forward completion notifications from the source by default", () => {

        spy = create({ defaultPlugins: false, warning: false });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.pipe(tag("people")).subscribe(value => values.push(value));

        spy.pluginHost.plug(new PipePlugin({
            match: "people",
            operator: () => of("bob"),
            pluginHost: spy.pluginHost
        }));

        subject.next("alice");
        expect(values).to.deep.equal(["bob"]);
        expect(subscription).to.have.property("closed", true);
    });

    it("should ignore completion notifications from the source if required", () => {

        spy = create({ defaultPlugins: false, warning: false });

        const values: any[] = [];
        const subject = new Subject<string>();
        const subscription = subject.pipe(tag("people")).subscribe(value => values.push(value));

        spy.pluginHost.plug(new PipePlugin({
            complete: false,
            match: "people",
            operator: () => of("bob"),
            pluginHost: spy.pluginHost
        }));

        subject.next("alice");
        expect(values).to.deep.equal(["bob"]);
        expect(subscription).to.have.property("closed", false);
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
