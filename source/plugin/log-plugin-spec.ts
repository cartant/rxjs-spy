/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { identify } from "../identify";
import { LogPlugin } from "./log-plugin";
import { SubscriberRefsPlugin } from "./subscriber-refs-plugin";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { SubscriptionRef } from "../subscription-ref";

import "../add/operator/tag";

const options = {
    defaultPlugins: false,
    warning: false
};

describe("LogPlugin", () => {

    let calls: any[][];
    let spy: Spy;
    let subscriberRefsPlugin: SubscriberRefsPlugin;

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });

    describe("tags", () => {

        beforeEach(() => {

            spy = create(options);

            const plugin = new LogPlugin(spy, "people", {
                log(...args: any[]): void { calls.push(args); }
            });
            spy.plug(plugin);
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
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next; value =", "alice"]);

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
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next; value =", null]);

            subscription.unsubscribe();
        });

        it("should log undefined values", () => {

            const subject = new Subject<string | undefined>();

            const subscription = subject.tag("people").subscribe();

            calls = [];

            subject.next(undefined);
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next; value =", undefined]);

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
            expect(calls[0]).to.deep.equal(["Tag = people; notification = error; error =", error]);
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
            spy = create(options);
            spy.plug(subscriberRefsPlugin);
            calls = [];
        });

        it("should match observable ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriberRefsPlugin.get(subject) as SubscriptionRef;
            spy.plug(new LogPlugin(spy, identify(subscriptionRef.observable), {
                log(...args: any[]): void { calls.push(args); }
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Type = Subject; notification = next; value =", "alice"]);
        });

        it("should match subscriber ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriberRefsPlugin.get(subject) as SubscriptionRef;
            spy.plug(new LogPlugin(spy, identify(subscriptionRef.subscriber), {
                log(...args: any[]): void { calls.push(args); }
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Type = Subject; notification = next; value =", "alice"]);
        });

        it("should match subscription ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriberRefsPlugin.get(subject) as SubscriptionRef;
            spy.plug(new LogPlugin(spy, identify(subscriptionRef.subscription), {
                log(...args: any[]): void { calls.push(args); }
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Type = Subject; notification = next; value =", "alice"]);
        });
    });
});
