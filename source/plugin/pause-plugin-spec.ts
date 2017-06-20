/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { spy } from "../spy";
import { Deck, PausePlugin } from "./pause-plugin";

import "../add/operator/tag";

describe("PausePlugin", () => {

    let calls: any[][];
    let deck: Deck;
    let plugin: PausePlugin;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        plugin = new PausePlugin("people");
        deck = plugin.deck();

        teardown = spy({ plugins: [plugin] });
        calls = [];
    });

    describe("clear", () => {

        it("should clear the subscription's paused values", () => {

            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe();

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(deck.values()).to.deep.equal(["alice"]);
            deck.clear();
            expect(deck.values()).to.deep.equal([]);
        });

        it("should not release paused values", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            deck.clear();
            expect(values).to.deep.equal([]);
        });
    });

    describe("next", () => {

        it("should emit the next value", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            subject.next("bob");
            subject.next("mallory");
            expect(values).to.deep.equal([]);
            deck.next();
            expect(values).to.deep.equal(["alice"]);
            deck.next();
            expect(values).to.deep.equal(["alice", "bob"]);
        });

        it("should do nothing if there are no paused values", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(values).to.deep.equal([]);
            deck.next();
            expect(values).to.deep.equal(["alice"]);
            deck.next();
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

        it("should not emit values if unsubscribed whilst paused", () => {

            const values: any[] = [];
            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe((value) => values.push(value));

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(values).to.deep.equal([]);
            subscription.unsubscribe();
            deck.resume();
            expect(values).to.deep.equal([]);
        });
    });

    describe("values", () => {

        it("should return the subscription's paused values", () => {

            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe();

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            expect(deck.values()).to.deep.equal(["alice"]);
        });

        it("should not include released values", () => {

            const subject = new Subject<string>();
            const subscription = subject.tag("people").subscribe();

            expect(deck).to.have.property("paused", true);
            subject.next("alice");
            deck.next();
            expect(deck.values()).to.deep.equal([]);
        });
    });
});
