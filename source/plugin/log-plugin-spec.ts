/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs";
import { create } from "../factory";
import { identify } from "../identify";
import { tag } from "../operators";
import { Spy } from "../spy";
import { LogPlugin } from "./log-plugin";
import { SubscriptionRecordsPlugin } from "./subscription-records-plugin";

const options = {
    defaultPlugins: false,
    warning: false
};

describe("LogPlugin", () => {

    let calls: any[][];
    let spy: Spy;
    let subscriptionRecordsPlugin: SubscriptionRecordsPlugin;

    describe("tags", () => {

        beforeEach(() => {

            spy = create(options);

            const plugin = new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: "people",
                pluginHost: spy.pluginHost
            });
            spy.pluginHost.plug(plugin);
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

            subject.pipe(tag("people")).subscribe();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = subscribe"]);

            calls = [];

            subject.complete();
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal(["Tag = people; notification = complete"]);
        });

        it("should log error", () => {

            const subject = new Subject<string>();

            subject.pipe(tag("people")).subscribe(value => {}, error => {});
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
            subscriptionRecordsPlugin = new SubscriptionRecordsPlugin({ pluginHost: spy.pluginHost });
            spy.pluginHost.plug(subscriptionRecordsPlugin);
            calls = [];
        });

        it("should match observable ids", () => {

            const subject = new Subject<string>();
            subject.subscribe();

            const subscriptionRecord = subscriptionRecordsPlugin.getSubscriptionRecord(subject);
            spy.pluginHost.plug(new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: identify(subscriptionRecord.observable),
                pluginHost: spy.pluginHost
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal([`ID = ${identify(subscriptionRecord.observable)}; notification = next; value =`, "alice"]);
        });

        it("should match subscriber ids", () => {

            const subject = new Subject<string>();
            subject.subscribe();

            const subscriptionRecord = subscriptionRecordsPlugin.getSubscriptionRecord(subject);
            spy.pluginHost.plug(new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: identify(subscriptionRecord.subscriber),
                pluginHost: spy.pluginHost
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal([`ID = ${identify(subscriptionRecord.observable)}; notification = next; value =`, "alice"]);
        });

        it("should match subscription ids", () => {

            const subject = new Subject<string>();
            subject.subscribe();

            const subscriptionRecord = subscriptionRecordsPlugin.getSubscriptionRecord(subject);
            spy.pluginHost.plug(new LogPlugin({
                logger: {
                    log(...args: any[]): void { calls.push(args); }
                },
                observableMatch: identify(subscriptionRecord.subscription),
                pluginHost: spy.pluginHost
            }));

            calls = [];

            subject.next("alice");
            expect(calls).to.not.be.empty;
            expect(calls[0]).to.deep.equal([`ID = ${identify(subscriptionRecord.observable)}; notification = next; value =`, "alice"]);
        });
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
