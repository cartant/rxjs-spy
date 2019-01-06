/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { NEVER, Subject, zip } from "rxjs";
import { bufferWhen, concatMap, mergeMap } from "rxjs/operators";
import * as sinon from "sinon";
import { patch } from "../factory";
import { Patcher } from "../patcher";
import { BufferPlugin } from "./buffer-plugin";
import { GraphPlugin } from "./graph-plugin";
import { SnapshotPlugin } from "./snapshot-plugin";
import { StackTracePlugin } from "./stack-trace-plugin";

const options = {
    defaultPlugins: false,
    warning: false
};

describe("BufferPlugin", () => {

    let patcher: Patcher;
    let stubs: Record<string, sinon.SinonStub>;

    beforeEach(() => {

        stubs = {
            error: sinon.stub(),
            log: sinon.stub(),
            warn: sinon.stub()
        };
        patcher = patch({ ...options, defaultLogger: stubs as any });
        patcher.pluginHost.plug(new StackTracePlugin({ pluginHost: patcher.pluginHost }));
        patcher.pluginHost.plug(new GraphPlugin({ pluginHost: patcher.pluginHost }));
        patcher.pluginHost.plug(new SnapshotPlugin({ pluginHost: patcher.pluginHost }));
        patcher.pluginHost.plug(new BufferPlugin({
            bufferThreshold: 2,
            pluginHost: patcher.pluginHost
        }));
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
        expect(message).to.match(/name = bufferWhen/);
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
        expect(message).to.match(/name = mergeMap/);
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
        expect(message).to.match(/name = zip/);
        expect(message).to.match(/count = 2/);
        expect(message).to.match(/subscribed at\n/);
        expect(message).to.match(/buffer-plugin-spec\.(js|ts)/);

        subscription.unsubscribe();
    });

    afterEach(() => {

        if (patcher) {
            patcher.teardown();
        }
    });
});
