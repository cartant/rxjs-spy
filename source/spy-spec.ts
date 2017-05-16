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
import { attach, detach, tick } from "./spy";

describe("spy", () => {

    let plugin: Plugin;

    beforeEach(() => {

        plugin = {
            afterComplete: sinon.stub(),
            afterError: sinon.stub(),
            afterNext: sinon.stub(),
            afterSubscribe: sinon.stub(),
            afterUnsubscribe: sinon.stub(),
            beforeComplete: sinon.stub(),
            beforeError: sinon.stub(),
            beforeNext: sinon.stub(),
            beforeSubscribe: sinon.stub(),
            beforeUnsubscribe: sinon.stub()
        } as any;
    });

    describe("attach/detach", () => {

        it("should rewire subscribe", () => {

            const subscribe = Observable.prototype.subscribe;
            attach(plugin);
            expect(Observable.prototype.subscribe).to.not.equal(subscribe);
            detach(plugin);
            expect(Observable.prototype.subscribe).to.equal(subscribe);
        });
    });

    describe("plugin", () => {

        it("should call the plugin subscribe/next/unsubscribe methods", () => {

            const subject = new Subject<string>();

            attach(plugin);

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("called", true);
            expect(plugin.afterSubscribe).to.have.property("called", true);

            subject.next("alice");
            expect(plugin.beforeNext).to.have.property("called", true);
            expect(plugin.afterNext).to.have.property("called", true);

            subscription.unsubscribe();
            expect(plugin.beforeUnsubscribe).to.have.property("called", true);
            expect(plugin.afterUnsubscribe).to.have.property("called", true);

            detach(plugin);
        });

        it("should call the plugin complete methods", () => {

            const subject = new Subject<string>();

            attach(plugin);

            const subscription = subject.subscribe();
            expect(plugin.beforeSubscribe).to.have.property("called", true);
            expect(plugin.afterSubscribe).to.have.property("called", true);

            subject.complete();
            expect(plugin.beforeComplete).to.have.property("called", true);
            expect(plugin.afterComplete).to.have.property("called", true);

            detach(plugin);
        });

        it("should call the plugin error methods", () => {

            const subject = new Subject<string>();

            attach(plugin);

            const subscription = subject.subscribe((value) => {}, (error) => {});
            expect(plugin.beforeSubscribe).to.have.property("called", true);
            expect(plugin.afterSubscribe).to.have.property("called", true);

            subject.error(new Error("Boom!"));
            expect(plugin.beforeError).to.have.property("called", true);
            expect(plugin.afterError).to.have.property("called", true);

            detach(plugin);
        });
    });

    describe("tick", () => {

        it("should increment with each subscription and value, etc.", () => {

            const subject = new Subject<string>();

            attach(plugin);

            let last = tick();
            const subscription = subject.subscribe();
            expect(tick()).to.be.above(last);

            last = tick();
            subject.next("alice");
            expect(tick()).to.be.above(last);

            last = tick();
            subscription.unsubscribe();
            expect(tick()).to.be.above(last);

            detach(plugin);
        });
    });
});
