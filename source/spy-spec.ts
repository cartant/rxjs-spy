/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import * as sinon from "sinon";
import { Plugin } from "./plugin";
import { log, patch, show, spy, tick } from "./spy";

describe("spy", () => {

    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    describe("log", () => {

        it("should log the tagged observable", () => {

            teardown = spy({ plugins: [] });

            const subject = new Subject<string>();
            let calls: any[][] = [];

            log("people", {
                log(...args: any[]): void { calls.push(args); }
            });

            const subscription = subject.tag("people").subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; event = subscribe"]);

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["alice; tag = people; event = next"]);

            calls = [];

            subscription.unsubscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; event = unsubscribe"]);
        });
    });

    describe("patch", () => {

        it("should patch the tagged observable", () => {

            teardown = spy({ plugins: [] });
            patch("people", "bob");

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            expect(values).to.deep.equal(["bob"]);
        });
    });

    describe("plugin", () => {

        let plugin: Plugin;

        beforeEach(() => {

            plugin = {
                afterComplete: sinon.stub(),
                afterError: sinon.stub(),
                afterNext: sinon.stub(),
                afterSubscribe: sinon.stub(),
                afterUnsubscribe: sinon.stub(),
                beforeComplete: sinon.stub(),
                beforeError: sinon.stub(),
                beforeNext: sinon.stub(),
                beforeSubscribe: sinon.stub(),
                beforeUnsubscribe: sinon.stub(),
                patch: sinon.stub().returns(null)
            } as any;
            teardown = spy({ plugins: [plugin] });
        });

        it("should call the plugin subscribe/next/unsubscribe methods", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("called", true);
            expect(plugin.afterSubscribe).to.have.property("called", true);

            subject.next("alice");
            expect(plugin.beforeNext).to.have.property("called", true);
            expect(plugin.afterNext).to.have.property("called", true);

            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("called", true);
            expect(plugin.afterUnsubscribe).to.have.property("called", true);
        });

        it("should call the plugin complete methods", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("called", true);
            expect(plugin.afterSubscribe).to.have.property("called", true);

            subject.complete();
            expect(plugin.beforeComplete).to.have.property("called", true);
            expect(plugin.afterComplete).to.have.property("called", true);
        });

        it("should call the plugin error methods", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe((value) => {}, (error) => {});
            expect(plugin.beforeSubscribe).to.have.property("called", true);
            expect(plugin.afterSubscribe).to.have.property("called", true);

            subject.error(new Error("Boom!"));
            expect(plugin.beforeError).to.have.property("called", true);
            expect(plugin.afterError).to.have.property("called", true);
        });
    });

    describe("show", () => {

        it("should show snapshotted information for the tagged observable", () => {

            teardown = spy();

            const calls: any[][] = [];
            const subject = new Subject<number>();
            const subscription = subject.tag("people").subscribe();

            show("people", {
                log(...args: any[]): void { calls.push(args); }
            });

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Snapshot(s) matching people"]);
            expect(calls[1]).to.deep.equal(["  Tag = people"]);
        });

        it("should show snapshotted information all/any tagged observables", () => {

            teardown = spy();

            const calls: any[][] = [];
            const subject = new Subject<number>();
            const subscription = subject.tag("people").subscribe();

            show({
                log(...args: any[]): void { calls.push(args); }
            });

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Snapshot(s) matching /.+/"]);
            expect(calls[1]).to.deep.equal(["  Tag = people"]);
        });

        it("should throw an error if snapshotting is not enabled", () => {

            teardown = spy({ plugins: [] });

            const subject = new Subject<number>();
            const subscription = subject.tag("people").subscribe();

            expect(() => show("people")).to.throw(/not enabled/);
        });
    });

    describe("tick", () => {

        it("should increment with each subscription and value, etc.", () => {

            teardown = spy({ plugins: [] });

            const subject = new Subject<string>();

            let last = tick();
            const subscription = subject.subscribe();
            expect(tick()).to.be.above(last);

            last = tick();
            subject.next("alice");
            expect(tick()).to.be.above(last);

            last = tick();
            subscription.unsubscribe();
            expect(tick()).to.be.above(last);
        });
    });
});
