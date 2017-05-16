/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Listener, ListenerEvent } from "./listener";

import "./add/operator/tag";

describe("listener", () => {

    let events: ListenerEvent[];
    let listener: Listener;

    afterEach(() => {

        listener.detach();
    });

    beforeEach(() => {

        events = [];
        listener = new Listener("people");

        listener.on("afterComplete", handler);
        listener.on("afterError", handler);
        listener.on("afterNext", handler);
        listener.on("afterSubscribe", handler);
        listener.on("afterUnsubscribe", handler);
        listener.on("beforeComplete", handler);
        listener.on("beforeError", handler);
        listener.on("beforeNext", handler);
        listener.on("beforeSubscribe", handler);
        listener.on("beforeUnsubscribe", handler);

        function handler(event: ListenerEvent): void {
            events.push(event);
        }
    });

    it("should listen to subscribe/next/unsubscribe", () => {

        const subject = new Subject<string>();

        const subscription = subject.tag("people").subscribe();
        expect(events).to.have.length(2);
        expect(events[0]).to.have.property("type", "beforeSubscribe");
        expect(events[1]).to.have.property("type", "afterSubscribe");

        subject.next("alice");
        expect(events).to.have.length(4);
        expect(events[2]).to.have.property("type", "beforeNext");
        expect(events[2]).to.have.property("value", "alice");
        expect(events[3]).to.have.property("type", "afterNext");
        expect(events[3]).to.have.property("value", "alice");

        subscription.unsubscribe();
        expect(events).to.have.length(6);
        expect(events[4]).to.have.property("type", "beforeUnsubscribe");
        expect(events[5]).to.have.property("type", "afterUnsubscribe");
    });

    it("should listen to complete", () => {

        const subject = new Subject<string>();

        const subscription = subject.tag("people").subscribe();
        expect(events).to.have.length(2);
        expect(events[0]).to.have.property("type", "beforeSubscribe");
        expect(events[1]).to.have.property("type", "afterSubscribe");

        subject.complete();
        expect(events).to.have.length(4);
        expect(events[2]).to.have.property("type", "beforeComplete");
        expect(events[3]).to.have.property("type", "afterComplete");
    });

    it("should listen to error", () => {

        const subject = new Subject<string>();

        const subscription = subject.tag("people").subscribe((value) => {}, (error) => {});
        expect(events).to.have.length(2);
        expect(events[0]).to.have.property("type", "beforeSubscribe");
        expect(events[1]).to.have.property("type", "afterSubscribe");

        const error = new Error("Boom!");
        subject.error(error);
        expect(events).to.have.length(4);
        expect(events[2]).to.have.property("type", "beforeError");
        expect(events[2]).to.have.property("error", error);
        expect(events[3]).to.have.property("type", "afterError");
        expect(events[3]).to.have.property("error", error);
    });

    it("should ignore untagged observables", () => {

        const subject = new Subject<string>();

        const subscription = subject.subscribe();
        expect(events).to.have.length(0);

        subject.next("alice");
        expect(events).to.have.length(0);

        subscription.unsubscribe();
        expect(events).to.have.length(0);
    });
});
