/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs";
import { mapTo } from "rxjs/operators";
import * as sinon from "sinon";
import { patch } from "./factory";
import { tag }  from "./operators";
import { Patcher } from "./patcher";
import { Plugin } from "./plugins";

const options = {
    keptDuration: -1,
    keptValues: 4,
    warning: false
};

describe("patcher", () => {

    let patcher: Patcher;

    describe("log", () => {

        it("should log the tagged observable", () => {

            patcher = patch({ ...options, defaultPlugins: false });

            const subject = new Subject<string>();
            let calls: any[][] = [];

            patcher.log("people", {
                log(...args: any[]): void { calls.push(args); }
            });

            const subscription = subject.pipe(tag("people")).subscribe();
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

            patcher = patch({ ...options, defaultPlugins: false });

            const subject = new Subject<string>();
            const calls: any[][] = [];

            patcher.log({
                log(...args: any[]): void { calls.push(args); }
            });

            subject.pipe(tag("people")).subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe; matching /.+/"]);
        });

        it("should support a notification match", () => {

            patcher = patch({ ...options, defaultPlugins: false });

            const subject = new Subject<string>();
            const calls: any[][] = [];

            patcher.log(/people/, /next/, {
                log(...args: any[]): void { calls.push(args); }
            });

            const subscription = subject.pipe(tag("people")).subscribe();
            subject.next("alice");
            subscription.unsubscribe();

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next; matching /people/; value =", "alice"]);
        });
    });

    describe("pause", () => {

        it("should pause the tagged observable's subscriptions", () => {

            patcher = patch({ ...options, defaultPlugins: false });
            const deck = patcher.pause("people");

            const values: any[] = [];
            const subject = new Subject<string>();
            subject.pipe(tag("people")).subscribe(value => values.push(value));

            subject.next("alice");
            subject.next("bob");
            expect(values).to.deep.equal([]);
            deck.resume();
            expect(values).to.deep.equal(["alice", "bob"]);
        });

        it("should resume upon teardown", () => {

            patcher = patch({ ...options, defaultPlugins: false });
            patcher.pause("people");

            const values: any[] = [];
            const subject = new Subject<string>();
            subject.pipe(tag("people")).subscribe(value => values.push(value));

            subject.next("alice");
            subject.next("bob");
            expect(values).to.deep.equal([]);
            patcher.teardown();
            expect(values).to.deep.equal(["alice", "bob"]);
        });
    });

    describe("pipe", () => {

        it("should apply the operator to the tagged observable", () => {

            patcher = patch({ ...options, defaultPlugins: false });
            patcher.pipe("people", source => source.pipe(mapTo("bob")));

            const values: any[] = [];
            const subject = new Subject<string>();
            subject.pipe(tag("people")).subscribe(value => values.push(value));

            subject.next("alice");
            expect(values).to.deep.equal(["bob"]);
        });
    });

    describe("pluginHost", () => {

        describe("plugin", () => {

            let plugin: Plugin;

            beforeEach(() => {

                plugin = stubPlugin();
                patcher = patch({ ...options, defaultPlugins: false });
                patcher.pluginHost.plug(plugin);
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

                const subscription = subject.pipe(mapTo("mallory")).subscribe();
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

                subject.subscribe();
                expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

                subject.complete();
                expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
            });

            it("should call the plugin unsubscribe methods on error", () => {

                const subject = new Subject<string>();

                subject.subscribe(() => {}, () => {});
                expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

                subject.error(new Error("Boom!"));
                expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
            });

            it("should call the plugin unsubscribe methods when paused for explicit unsubscribes", () => {

                const subject = new Subject<string>();

                const subscription = subject.pipe(tag("people")).subscribe();
                expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
                expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

                patcher.pause("people");
                subscription.unsubscribe();
                expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
                expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
            });

            it("should call the plugin unsubscribe methods on resumed completion", () => {

                const subject = new Subject<string>();

                subject.pipe(tag("people")).subscribe();
                expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
                expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

                const deck = patcher.pause("people");
                subject.complete();
                expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
                deck.resume();
                expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
                expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
            });

            it("should call the plugin unsubscribe methods on resumed error", () => {

                const subject = new Subject<string>();

                subject.pipe(tag("people")).subscribe(() => {}, () => {});
                expect(plugin.beforeSubscribe).to.have.property("calledTwice", true);
                expect(plugin.afterSubscribe).to.have.property("calledTwice", true);

                const deck = patcher.pause("people");
                subject.error(new Error("Boom!"));
                expect(plugin.beforeUnsubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterUnsubscribe).to.have.property("calledOnce", true);
                deck.resume();
                expect(plugin.beforeUnsubscribe).to.have.property("calledTwice", true);
                expect(plugin.afterUnsubscribe).to.have.property("calledTwice", true);
            });

            it("should call the plugin complete methods", () => {

                const subject = new Subject<string>();

                subject.subscribe();
                expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

                subject.complete();
                expect(plugin.beforeComplete).to.have.property("calledOnce", true);
                expect(plugin.afterComplete).to.have.property("calledOnce", true);
            });

            it("should call the plugin error methods", () => {

                const subject = new Subject<string>();

                subject.subscribe(value => {}, error => {});
                expect(plugin.beforeSubscribe).to.have.property("calledOnce", true);
                expect(plugin.afterSubscribe).to.have.property("calledOnce", true);

                subject.error(new Error("Boom!"));
                expect(plugin.beforeError).to.have.property("calledOnce", true);
                expect(plugin.afterError).to.have.property("calledOnce", true);
            });
        });

        describe("tick", () => {

            it("should increment with each subscription and value, etc.", () => {

                patcher = patch({ ...options, defaultPlugins: false });

                const subject = new Subject<string>();

                let last = patcher.pluginHost.tick;
                const subscription = subject.subscribe();
                expect(patcher.pluginHost.tick).to.be.above(last);

                last = patcher.pluginHost.tick;
                subject.next("alice");
                expect(patcher.pluginHost.tick).to.be.above(last);

                last = patcher.pluginHost.tick;
                subscription.unsubscribe();
                expect(patcher.pluginHost.tick).to.be.above(last);
            });
        });
    });

    describe("query", () => {

        it("should show snapshotted information for the tagged observable", () => {

            patcher = patch({ ...options });

            const calls: any[][] = [];
            const subject = new Subject<number>();
            subject.pipe(tag("people")).subscribe();

            patcher.query("tag(/people/)", {
                log(...args: any[]): void { calls.push(args); }
            });

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["1 snapshot(s) found"]);
            expect(calls[1][0]).to.match(/tag = people/);
        });

        it("should show snapshotted information all/any tagged observables", () => {

            patcher = patch({ ...options });

            const calls: any[][] = [];
            const subject = new Subject<number>();
            subject.pipe(tag("people")).subscribe();

            patcher.query("tag()", {
                log(...args: any[]): void { calls.push(args); }
            });

            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["1 snapshot(s) found"]);
            expect(calls[1][0]).to.match(/tag = people/);
        });
    });

    describe("stats", () => {

        it("should show the stats", () => {

            patcher = patch({ ...options });

            const calls: any[][] = [];
            const subject = new Subject<number>();
            subject.subscribe();

            patcher.stats({
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

    describe("version", () => {

        it("should return the package version", () => {

            patcher = patch({ ...options, defaultPlugins: false });
            expect(patcher).to.have.property("version", require("../package.json").version);
        });
    });

    if (typeof window !== "undefined") {

        describe("window", () => {

            it("should create a global named 'spy' by default", () => {

                patcher = patch({ ...options });
                expect(window).to.have.property("spy");
            });

            it("should create a global with the specified name", () => {

                patcher = patch({ ...options, global: "_spy" });
                expect(window).to.not.have.property("spy");
                expect(window).to.have.property("_spy");
            });
        });
    }

    afterEach(() => {

        if (patcher) {
            patcher.teardown();
        }
    });
});

function stubPlugin(): Plugin {

    return {
        afterComplete: sinon.stub(),
        afterError: sinon.stub(),
        afterLift: sinon.stub(),
        afterNext: sinon.stub(),
        afterPipe: sinon.stub(),
        afterSubscribe: sinon.stub(),
        afterUnsubscribe: sinon.stub(),
        beforeComplete: sinon.stub(),
        beforeError: sinon.stub(),
        beforeLift: sinon.stub(),
        beforeNext: sinon.stub(),
        beforePipe: sinon.stub(),
        beforeSubscribe: sinon.stub(),
        beforeUnsubscribe: sinon.stub(),
        getOperator: sinon.stub().returns(undefined),
        teardown: sinon.stub()
    } as any;
}
