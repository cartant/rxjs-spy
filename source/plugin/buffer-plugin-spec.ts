/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { NEVER, Subject, zip } from "rxjs";
import { bufferWhen, concatMap, mergeMap } from "rxjs/operators";
import * as sinon from "sinon";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { BufferPlugin } from "./buffer-plugin";
import { GraphPlugin } from "./graph-plugin";
import { SnapshotPlugin } from "./snapshot-plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

const options = {
    defaultPlugins: false,
    warning: false
};

describe("BufferPlugin", () => {

    let spy: Spy;
    let stubs: Record<string, sinon.SinonStub>;

    beforeEach(() => {

        stubs = {
            error: sinon.stub(),
            log: sinon.stub(),
            warn: sinon.stub()
        };
        spy = create({ ...options, defaultLogger: stubs as any });
        spy.plug(new StackTracePlugin({ spy }));
        spy.plug(new GraphPlugin({ spy }));
        spy.plug(new SnapshotPlugin({ spy }));

        const plugin = new BufferPlugin({
            bufferThreshold: 2,
            spy
        });
        spy.plug(plugin);
    });

    it("should be detect buffering within bufferWhen", () => {

        const subject = new Subject<number>();
        const buffered = subject.pipe(bufferWhen(() => NEVER));
        const subscription = buffered.subscribe(() => {});

        subject.next(1);

        expect(stubs.warn).to.have.property("calledOnce", false);

        subject.next(2);

        expect(stubs.warn).to.have.property("calledOnce", true);
        const [message] = stubs.warn.firstCall.args;
        expect(message).to.match(/^Excessive buffering detected/);
        expect(message).to.match(/type = bufferWhen/);
        expect(message).to.match(/count = 2/);
        expect(message).to.match(/subscribed at\n/);
        expect(message).to.match(/buffer-plugin-spec\.(js|ts)/);

        subscription.unsubscribe();
    });

    it("should be detect buffering within concatMap", () => {

        const subject = new Subject<number>();
        const buffered = subject.pipe(concatMap(() => NEVER));
        const subscription = buffered.subscribe(() => {});

        subject.next(1);

        expect(stubs.warn).to.have.property("calledOnce", false);

        subject.next(2);

        expect(stubs.warn).to.have.property("calledOnce", false);

        subject.next(3);

        expect(stubs.warn).to.have.property("calledOnce", true);
        const [message] = stubs.warn.firstCall.args;
        expect(message).to.match(/^Excessive buffering detected/);
        expect(message).to.match(/type = mergeMap/);
        expect(message).to.match(/count = 2/);
        expect(message).to.match(/subscribed at\n/);
        expect(message).to.match(/buffer-plugin-spec\.(js|ts)/);

        subscription.unsubscribe();
    });

    it("should not effect false positives with mergeMap", () => {

        const subject = new Subject<number>();
        const buffered = subject.pipe(mergeMap(() => NEVER));
        const subscription = buffered.subscribe(() => {});

        subject.next(1);

        expect(stubs.warn).to.have.property("calledOnce", false);

        subject.next(2);

        expect(stubs.warn).to.have.property("calledOnce", false);

        subject.next(3);

        expect(stubs.warn).to.have.property("calledOnce", false);

        subscription.unsubscribe();
    });

    it("should be detect buffering within zip", () => {

        const subject = new Subject<number>();
        const zipped = zip(subject, NEVER);
        const subscription = zipped.subscribe(() => {});

        subject.next(1);

        expect(stubs.warn).to.have.property("calledOnce", false);

        subject.next(2);

        expect(stubs.warn).to.have.property("calledOnce", true);
        const [message] = stubs.warn.firstCall.args;
        expect(message).to.match(/^Excessive buffering detected/);
        expect(message).to.match(/type = zip/);
        expect(message).to.match(/count = 2/);
        expect(message).to.match(/subscribed at\n/);
        expect(message).to.match(/buffer-plugin-spec\.(js|ts)/);

        subscription.unsubscribe();
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
