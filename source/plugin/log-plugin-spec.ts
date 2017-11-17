/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { identify } from "../identify";
import { SubscriptionRef } from "../interfaces";
import { LogPlugin } from "./log-plugin";
import { SubscriberRefsPlugin } from "./subscriber-refs-plugin";
import { plugin, spy } from "../spy";

import "../add/operator/tag";

describe("LogPlugin", () => {

    let calls: any[][];
    let subscriberRefsPlugin: SubscriberRefsPlugin;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    describe("tags", () => {

        beforeEach(() => {

            const plugin = new LogPlugin("people", {
                log(...args: any[]): void { calls.push(args); }
            });
            teardown = spy({ plugins: [plugin], warning: false });
            calls = [];
        });

        it("should log subscribe/next/unsubscribe", () => {

            const subject = new Subject<string>();

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

        it("should log null values", () => {

            const subject = new Subject<string | null>();

            const subscription = subject.tag("people").subscribe();

            calls = [];

            subject.next(null);
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next"]);
            expect(calls[1]).to.deep.equal(["  Value =", null]);

            subscription.unsubscribe();
        });

        it("should log undefined values", () => {

            const subject = new Subject<string | undefined>();

            const subscription = subject.tag("people").subscribe();

            calls = [];

            subject.next(undefined);
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next"]);
            expect(calls[1]).to.deep.equal(["  Value =", undefined]);

            subscription.unsubscribe();
        });

        it("should log complete", () => {

            const subject = new Subject<string>();

            const subscription = subject.tag("people").subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe"]);

            calls = [];

            subject.complete();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = complete"]);
        });

        it("should log error", () => {

            const subject = new Subject<string>();

            const subscription = subject.tag("people").subscribe((value) => {}, (error) => {});
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe"]);

            calls = [];

            const error = new Error("Boom!");
            subject.error(error);
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = error"]);
            expect(calls[1]).to.deep.equal(["  Error =", error]);
        });

        it("should ignore untagged observables", () => {

            const subject = new Subject<string>();

            const subscription = subject.subscribe();
            expect(calls).to.be.empty;

            calls = [];

            subject.next("alice");
            expect(calls).to.be.empty;

            calls = [];

            subscription.unsubscribe();
            expect(calls).to.be.empty;
        });
    });

    describe("ids", () => {

        beforeEach(() => {

            subscriberRefsPlugin = new SubscriberRefsPlugin();
            teardown = spy({ plugins: [subscriberRefsPlugin ], warning: false });
            calls = [];
        });

        it("should match observable ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriberRefsPlugin.get(subject) as SubscriptionRef;
            plugin(new LogPlugin(identify(subscriptionRef.observable), {
                log(...args: any[]): void { calls.push(args); }
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Type = Subject; notification = next"]);
            expect(calls[1]).to.deep.equal(["  Value =", "alice"]);
        });

        it("should match subscriber ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriberRefsPlugin.get(subject) as SubscriptionRef;
            plugin(new LogPlugin(identify(subscriptionRef.subscriber), {
                log(...args: any[]): void { calls.push(args); }
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Type = Subject; notification = next"]);
            expect(calls[1]).to.deep.equal(["  Value =", "alice"]);
        });

        it("should match subscription ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriberRefsPlugin.get(subject) as SubscriptionRef;
            plugin(new LogPlugin(identify(subscriptionRef.subscription), {
                log(...args: any[]): void { calls.push(args); }
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Type = Subject; notification = next"]);
            expect(calls[1]).to.deep.equal(["  Value =", "alice"]);
        });
    });
});
