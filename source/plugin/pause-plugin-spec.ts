/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Notification } from "rxjs/Notification";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { PartialLogger } from "../logger";
import { Deck, DeckStats, PausePlugin } from "./pause-plugin";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";

import "../add/operator/tag";

describe("PausePlugin", () => {

    let calls: any[][];
    let deck: Deck;
    let plugin: PausePlugin;
    let spy: Spy;

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });

    beforeEach(() => {

        spy = create({ defaultPlugins: false, warning: false });
        plugin = new PausePlugin("people");
        spy.plug(plugin);

        deck = plugin.deck;
        calls = [];
    });

    describe("clear", () => {

        it("should clear the subscription's paused notification", () => {

            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe();

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(notifications(deck)).to.deep.equal([
                new Notification<any>("N", "alice")
            ]);
            deck.clear();
            expect(notifications(deck)).to.deep.equal([]);
        });

        it("should not release paused notifications", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            deck.clear();
            expect(values).to.deep.equal([]);
        });
    });

    describe("log", () => {

        it("should log the subscription's paused notifications", () => {

            const calls: any[][] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe();

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            deck.log({
                log(...args: any[]): void { calls.push(args); }
            });
            expect(calls).to.deep.equal([
                ["Deck matching people"],
                ["  Paused =", true],
                ["  Observable; tag = people"],
                ["    Notifications =", [new Notification<any>("N", "alice")]]
            ]);
        });

        it("should not log released notifications", () => {

            const calls: any[][] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe();

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            deck.step();
            deck.log({
                log(...args: any[]): void { calls.push(args); }
            });
            expect(calls).to.deep.equal([
                ["Deck matching people"],
                ["  Paused =", true],
                ["  Observable; tag = people"],
                ["    Notifications =", []]
            ]);
        });
    });

    describe("skip", () => {

        it("should skip a paused notification", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            subject.next("bob");
            subject.next("mallory");
            expect(values).to.deep.equal([]);
            expect(notifications(deck)).to.deep.equal([
                new Notification<any>("N", "alice"),
                new Notification<any>("N", "bob"),
                new Notification<any>("N", "mallory")
            ]);
            deck.skip();
            expect(values).to.deep.equal([]);
            expect(notifications(deck)).to.deep.equal([
                new Notification<any>("N", "bob"),
                new Notification<any>("N", "mallory")
            ]);
            deck.skip();
            expect(values).to.deep.equal([]);
            expect(notifications(deck)).to.deep.equal([
                new Notification<any>("N", "mallory")
            ]);
        });

        it("should do nothing if there are no paused notifications", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(values).to.deep.equal([]);
            expect(notifications(deck)).to.deep.equal([
                new Notification<any>("N", "alice")
            ]);
            deck.skip();
            expect(values).to.deep.equal([]);
            expect(notifications(deck)).to.deep.equal([]);
            deck.skip();
            expect(values).to.deep.equal([]);
            expect(notifications(deck)).to.deep.equal([]);
        });
    });

    describe("stats", () => {

        it("should broadcast stats", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("stats");

            const stats: DeckStats[] = [];
            deck.stats.subscribe(value => stats.push(value));
            expect(stats).to.deep.equal([]);

            subject.next("alice");
            expect(stats).to.deep.equal([{
                notifications: 1,
                paused: true
            }]);

            deck.resume();
            expect(stats).to.deep.equal([{
                notifications: 1,
                paused: true
            }, {
                notifications: 0,
                paused: false
            }]);
        });
    });

    describe("step", () => {

        it("should emit a paused notification", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            subject.next("bob");
            subject.next("mallory");
            expect(values).to.deep.equal([]);
            deck.step();
            expect(values).to.deep.equal(["alice"]);
            deck.step();
            expect(values).to.deep.equal(["alice", "bob"]);
        });

        it("should do nothing if there are no paused notifications", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(values).to.deep.equal([]);
            deck.step();
            expect(values).to.deep.equal(["alice"]);
            deck.step();
            expect(values).to.deep.equal(["alice"]);
        });
    });

    describe("pause", () => {

        it("should pause the subscription", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(values).to.deep.equal([]);
        });

        it("should pause completions", () => {

            let complete = false;
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe(
                (value) => {},
                (error) => {},
                () => complete = true
            );

            expect(deck).to.have.property("paused", true);
            subject.complete();
            expect(complete).to.be.false;
            deck.step();
            expect(complete).to.be.true;
        });

        it("should pause errors", () => {

            const errors: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe(
                (value) => {},
                (error) => errors.push(error)
            );

            expect(deck).to.have.property("paused", true);
            subject.error(new Error("Boom!"));
            expect(errors).to.deep.equal([]);
            deck.step();
            expect(errors).to.have.length(1);
            expect(errors[0]).to.match(/Boom!/);
        });
    });

    describe("resume", () => {

        it("should resume the subscription", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(values).to.deep.equal([]);
            deck.resume();
            expect(values).to.deep.equal(["alice"]);
        });
    });
});

function notifications(deck: Deck): any[] {

    let calls = 0;
    let result: any[] = [];

    deck.log({
        log(...args: any[]): void {
            if (++calls === 4) {
                result = args[1];
            }
        }
    });
    return result;
}
