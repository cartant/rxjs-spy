/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs";
import { identify } from "../identify";
import { tag } from "../operators";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { SubscriptionRef } from "../subscription-ref";
import { LogPlugin } from "./log-plugin";
import { SubscriptionRefsPlugin } from "./subscription-refs-plugin";

const options = {
    defaultPlugins: false,
    warning: false
};

describe("LogPlugin", () => {

    let calls: any[][];
    let spy: Spy;
    let subscriptionRefsPlugin: SubscriptionRefsPlugin;

    describe("tags", () => {

        beforeEach(() => {

            spy = create(options);

            const plugin = new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: "people",
                spy
            });
            spy.plug(plugin);
            calls = [];
        });

        it("should log subscribe/next/unsubscribe", () => {

            const subject = new Subject<string>();

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

        it("should log null values", () => {

            const subject = new Subject<string | null>();

            const subscription = subject.pipe(tag("people")).subscribe();

            calls = [];

            subject.next(null);
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next; value =", null]);

            subscription.unsubscribe();
        });

        it("should log undefined values", () => {

            const subject = new Subject<string | undefined>();

            const subscription = subject.pipe(tag("people")).subscribe();

            calls = [];

            subject.next(undefined);
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = next; value =", undefined]);

            subscription.unsubscribe();
        });

        it("should log complete", () => {

            const subject = new Subject<string>();

            const subscription = subject.pipe(tag("people")).subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe"]);

            calls = [];

            subject.complete();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = complete"]);
        });

        it("should log error", () => {

            const subject = new Subject<string>();

            const subscription = subject.pipe(tag("people")).subscribe((value) => {}, (error) => {});
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

            spy = create(options);
            subscriptionRefsPlugin = new SubscriptionRefsPlugin({ spy });
            spy.plug(subscriptionRefsPlugin);
            calls = [];
        });

        it("should match observable ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriptionRefsPlugin.get(subject) as SubscriptionRef;
            spy.plug(new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: identify(subscriptionRef.observable),
                spy
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal([`ID = ${identify(subscriptionRef.observable)}; notification = next; value =`, "alice"]);
        });

        it("should match subscriber ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriptionRefsPlugin.get(subject) as SubscriptionRef;
            spy.plug(new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: identify(subscriptionRef.subscriber),
                spy
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal([`ID = ${identify(subscriptionRef.observable)}; notification = next; value =`, "alice"]);
        });

        it("should match subscription ids", () => {

            const subject = new Subject<string>();
            const subscription = subject.subscribe();

            const subscriptionRef = subscriptionRefsPlugin.get(subject) as SubscriptionRef;
            spy.plug(new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: identify(subscriptionRef.subscription),
                spy
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal([`ID = ${identify(subscriptionRef.observable)}; notification = next; value =`, "alice"]);
        });
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
