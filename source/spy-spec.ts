/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import * as sinon from "sinon";
import { Plugin } from "./plugin";
import { create } from "./spy-factory";
import { Spy } from "./spy-interface";

import "rxjs/add/operator/mapTo";
import "./add/operator/tag";

const options = {
    keptDuration: -1,
    keptValues: 4,
    warning: false
};

describe("spy", () => {

    let spy: Spy;

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });

    describe("flush", () => {

        let plugin: Plugin;

        beforeEach(() => {

            plugin = stubPlugin();
            spy = create({ defaultPlugins: false, ...options });
            spy.plug(plugin);
        });

        it("should call the plugin's flush method", () => {

            spy.flush();
            expect(plugin.flush).to.have.property("called", true);
        });
    });

    describe("let", () => {

        it("should apply the selector to the tagged observable", () => {

            spy = create({ defaultPlugins: false, ...options });
            spy.let("people", (source) => source.mapTo("bob"));

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            expect(values).to.deep.equal(["bob"]);
        });
    });

    describe("log", () => {

        it("should log the tagged observable", () => {

            spy = create({ defaultPlugins: false, ...options });

            const subject = new Subject<string>();
            let calls: any[][] = [];

            spy.log("people", {
                log(...args: any[]): void { calls.push(args); }
            });

            const subscription = subject.tag("people").subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe"]);

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next; value =", "alice"]);

            calls = [];

            subscription.unsubscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = unsubscribe"]);
        });

        it("should log all/any tagged observables", () => {

            spy = create({ defaultPlugins: false, ...options });

            const subject = new Subject<string>();
            const calls: any[][] = [];

            spy.log({
                log(...args: any[]): void { calls.push(args); }
            });

            const subscription = subject.tag("people").subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe; matching /.+/"]);
        });
    });

    describe("pause", () => {

        it("should pause the tagged observable's subscriptions", () => {

            spy = create({ defaultPlugins: false, ...options });
            const deck = spy.pause("people");

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

            spy = create({ defaultPlugins: false, ...options });
            const deck = spy.pause("people");

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            subject.next("alice");
            subject.next("bob");
            expect(values).to.deep.equal([]);
            spy.teardown();
            expect(values).to.deep.equal(["alice", "bob"]);
        });
    });

    describe("plugin", () => {

        let plugin: Plugin;

        beforeEach(() => {

            plugin = stubPlugin();
            spy = create({ defaultPlugins: false, ...options });
            spy.plug(plugin);
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

            const deck = spy.pause("people");
            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
        });

        it("should call the plugin unsubscribe methods on resumed completion", () => {

            const subject = new Subject<string>();

            const subscription = subject.tag("people").subscribe();
            expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
            expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

            const deck = spy.pause("people");
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

            const deck = spy.pause("people");
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

            spy = create({ ...options });

            const calls: any[][] = [];
            const subject = new Subject<number>();
            const subscription = subject.tag("people").subscribe();

            spy.show("people", {
                log(...args: any[]): void { calls.push(args); }
            });

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["1 snapshot(s) matching people"]);
            expect(calls[1]).to.deep.equal(["  Tag = people"]);
        });

        it("should show snapshotted information all/any tagged observables", () => {

            spy = create({ ...options });

            const calls: any[][] = [];
            const subject = new Subject<number>();
            const subscription = subject.tag("people").subscribe();

            spy.show({
                log(...args: any[]): void { calls.push(args); }
            });

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["1 snapshot(s) matching /.+/"]);
            expect(calls[1]).to.deep.equal(["  Tag = people"]);
        });
    });

    describe("stats", () => {

        it("should show the stats", () => {

            spy = create({ ...options });

            const calls: any[][] = [];
            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            spy.stats({
                log(...args: any[]): void { calls.push(args); }
            });

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Stats"]);
            expect(calls[1]).to.deep.equal(["  Subscribes =", 1]);
            expect(calls[2]).to.deep.equal(["  Root subscribes =", 1]);
            expect(calls[3]).to.deep.equal(["  Leaf subscribes =", 1]);
            expect(calls[4]).to.deep.equal(["  Unsubscribes =", 0]);
        });
    });

    describe("tick", () => {

        it("should increment with each subscription and value, etc.", () => {

            spy = create({ defaultPlugins: false, ...options });

            const subject = new Subject<string>();

            let last = spy.tick;
            const subscription = subject.subscribe();
            expect(spy.tick).to.be.above(last);

            last = spy.tick;
            subject.next("alice");
            expect(spy.tick).to.be.above(last);

            last = spy.tick;
            subscription.unsubscribe();
            expect(spy.tick).to.be.above(last);
        });
    });

    describe("version", () => {

        it("should return the package version", () => {

            spy = create({ defaultPlugins: false, ...options });
            expect(spy).to.have.property("version", require("../package.json").version);
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
        select: sinon.stub().returns(undefined),
        teardown: sinon.stub()
    } as any;
}
