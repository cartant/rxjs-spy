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
import { flush, _let, log, pause, show, spy, tick } from "./spy";

import "rxjs/add/operator/mapTo";

describe("spy", () => {

    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    describe("flush", () => {

        let plugin: Plugin;

        beforeEach(() => {

            plugin = stubPlugin();
            teardown = spy({ plugins: [plugin] });
        });

        it("should call the plugin's flush method", () => {

            flush();
            expect(plugin.flush).to.have.property("called", true);
        });
    });

    describe("let", () => {

        it("should apply the selector to the tagged observable", () => {

            teardown = spy({ plugins: [] });
            _let("people", (source) => source.mapTo("bob"));

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            expect(values).to.deep.equal(["bob"]);
        });
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
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe"]);

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next"]);
            expect(calls[1]).to.deep.equal(["  Value =", "alice"]);

            calls = [];

            subscription.unsubscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = unsubscribe"]);
        });

        it("should log all/any tagged observables", () => {

            teardown = spy({ plugins: [] });

            const subject = new Subject<string>();
            const calls: any[][] = [];

            log({
                log(...args: any[]): void { calls.push(args); }
            });

            const subscription = subject.tag("people").subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe; matching /.+/"]);
        });
    });

    describe("pause", () => {

        it("should pause the tagged observable's subscriptions", () => {

            teardown = spy({ plugins: [] });
            const deck = pause("people");

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            subject.next("bob");
            expect(values).to.deep.equal([]);
            deck.resume();
            expect(values).to.deep.equal(["alice", "bob"]);
        });

        it("should resume upon teardown", () => {

            teardown = spy({ plugins: [] });
            const deck = pause("people");

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            subject.next("bob");
            expect(values).to.deep.equal([]);
            teardown();
            expect(values).to.deep.equal(["alice", "bob"]);
        });
    });

    describe("plugin", () => {

        let plugin: Plugin;

        beforeEach(() => {

            plugin = stubPlugin();
            teardown = spy({ plugins: [plugin] });
        });

        it("should call the plugin subscribe/next/unsubscribe methods", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

            subject.next("alice");
            expect(plugin.beforeNext).to.have.property("calledOnce", true);
            expect(plugin.afterNext).to.have.property("calledOnce", true);

            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
        });

        it("should call the plugin subscribe/next/unsubscribe methods for each observable", () => {

            const subject = new Subject<string>();

            const subscription = subject.mapTo("mallory").subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

            subject.next("alice");
            expect(plugin.beforeNext).to.have.property("calledTwice", true);
            expect(plugin.afterNext).to.have.property("calledTwice", true);

            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
        });

        it("should call the plugin unsubscribe methods only once", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);

            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
        });

        it("should call the plugin unsubscribe methods on completion", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

            subject.complete();
            expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
        });

        it("should call the plugin unsubscribe methods on error", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

            subject.error(new Error("Boom!"));
            expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
        });

        it("should call the plugin unsubscribe methods when paused for explicit unsubscribes", () => {

            const subject = new Subject<string>();

            const subscription = subject.tag("people").subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

            const deck = pause("people");
            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
        });

        it("should call the plugin unsubscribe methods on resumed completion", () => {

            const subject = new Subject<string>();

            const subscription = subject.tag("people").subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

            const deck = pause("people");
            subject.complete();
            expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
            deck.resume();
            expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
        });

        it("should call the plugin unsubscribe methods on resumed error", () => {

            const subject = new Subject<string>();

            const subscription = subject.tag("people").subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

            const deck = pause("people");
            subject.error(new Error("Boom!"));
            expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
            deck.resume();
            expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
        });

        it("should call the plugin complete methods", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

            subject.complete();
            expect(plugin.beforeComplete).to.have.property("calledOnce", true);
            expect(plugin.afterComplete).to.have.property("calledOnce", true);
        });

        it("should call the plugin error methods", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe((value) => {}, (error) => {});
            expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
            expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

            subject.error(new Error("Boom!"));
            expect(plugin.beforeError).to.have.property("calledOnce", true);
            expect(plugin.afterError).to.have.property("calledOnce", true);
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
            expect(calls[0]).to.deep.equal(["1 snapshot(s) matching people"]);
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
            expect(calls[0]).to.deep.equal(["1 snapshot(s) matching /.+/"]);
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

function stubPlugin(): Plugin {

    return {
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
        flush: sinon.stub(),
        select: sinon.stub().returns(null),
        teardown: sinon.stub()
    } as any;
}
