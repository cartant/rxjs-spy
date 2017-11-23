/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs/Subject";
import * as sinon from "sinon";
import { EXTENSION_KEY, MESSAGE_REQUEST, PANEL_MESSAGE } from "../devtools/constants";
import { Connection, Extension } from "../devtools/interfaces";
import { DevToolsPlugin } from "./devtools-plugin";
import { GraphPlugin } from "./graph-plugin";
import { LogPlugin } from "./log-plugin";
import { PausePlugin } from "./pause-plugin";
import { SnapshotPlugin } from "./snapshot-plugin";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { StackTracePlugin } from "./stack-trace-plugin";

if (typeof window !== "undefined") {

    describe("DevToolsPlugin", () => {

        let mockConnection: any;
        let mockExtension: any;
        let mockUnsubscribe: any;
        let snapshotPlugin: SnapshotPlugin;
        let spy: Spy;

        afterEach(() => {

            if (spy) {
                spy.teardown();
            }
            expect(mockExtension.connect).to.have.property("callCount", 1);
            expect(mockConnection.disconnect).to.have.property("callCount", 1);

            window[EXTENSION_KEY] = undefined;
        });

        beforeEach(() => {

            mockUnsubscribe = sinon.stub();
            mockConnection = {
                disconnect: sinon.stub(),
                post: sinon.stub().returns(""),
                subscribe: sinon.stub().returns({ unsubscribe: mockUnsubscribe })
            };
            mockExtension = {
                connect: sinon.stub().returns(mockConnection)
            };
            window[EXTENSION_KEY] = mockExtension;

            spy = create({ defaultPlugins: false, warning: false });
            snapshotPlugin = new SnapshotPlugin(spy, { keptValues: 1 });
            spy.plugin(
                new StackTracePlugin(),
                new GraphPlugin({ keptDuration: -1 }),
                snapshotPlugin,
                new DevToolsPlugin(spy)
            );
        });

        it("should post notification messages", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            subject.next(1);
            subject.complete();

            const snapshot = snapshotPlugin.snapshotAll();
            return snapshot.sourceMapsResolved
                .then(waitAfterResolved)
                .then(() => {

                    expect(mockConnection.post).to.have.property("callCount", 6);
                    expect(mockConnection.post.args.map(([message]: [any]) => message.notification)).to.deep.equal([
                        "before-subscribe",
                        "after-subscribe",
                        "before-next",
                        "before-complete",
                        "before-unsubscribe",
                        "after-unsubscribe"
                    ]);
                });
        });

        it("should serialize circular values", () => {

            const subject = new Subject<any>();
            const subscription = subject.subscribe();

            const person: any = { name: "alice", employer: null };
            person.employer = person;

            subject.next(person);

            const snapshot = snapshotPlugin.snapshotAll();
            return snapshot.sourceMapsResolved
                .then(waitAfterResolved)
                .then(() => {

                    expect(mockConnection.post).to.have.property("callCount", 3);
                    expect(mockConnection.post.args.map(([post]: [any]) => post.notification)).to.deep.equal([
                        "before-subscribe",
                        "after-subscribe",
                        "before-next"
                    ]);

                    const [,, [message]] = mockConnection.post.args;
                    expect(message).to.have.property("value");
                    expect(message.value).to.have.property("json");
                    expect(message.value.json).to.match(/"name":\s*"alice"/);
                    expect(message.value.json).to.match(/"employer":\s*"\[Circular\]"/);
                });
        });

        it("should respond to 'snapshot'", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            expect(mockConnection.subscribe).to.have.property("callCount", 1);

            const [[next]] = mockConnection.subscribe.args;
            expect(next).to.have.be.a("function");

            next({
                messageType: MESSAGE_REQUEST,
                postId: "0",
                postType: PANEL_MESSAGE,
                requestType: "snapshot"
            });

            const snapshot = snapshotPlugin.snapshotAll();
            return snapshot.sourceMapsResolved
                .then(waitAfterResolved)
                .then(() => {

                    const [[response]] = mockConnection.post.args.filter(([post]: [any]) => post.messageType === "response");
                    expect(response).to.exist;
                    expect(response).to.have.property("request");
                    expect(response).to.have.property("snapshot");
                });
        });

        it("should respond to 'log'", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            expect(mockConnection.subscribe).to.have.property("callCount", 1);

            const [[next]] = mockConnection.subscribe.args;
            expect(next).to.have.be.a("function");

            next({
                match: "1",
                messageType: MESSAGE_REQUEST,
                postId: "0",
                postType: PANEL_MESSAGE,
                requestType: "log"
            });

            return waitAfterResolved()
                .then(() => {

                    const [[response]] = mockConnection.post.args.filter(([post]: [any]) => post.messageType === "response");
                    expect(response).to.exist;
                    expect(response).to.have.property("request");
                    expect(response).to.have.property("pluginId", "0");

                    const found = spy.find(LogPlugin)!;
                    expect(found).to.exist;

                    next({
                        messageType: MESSAGE_REQUEST,
                        pluginId: "0",
                        postId: "1",
                        postType: PANEL_MESSAGE,
                        requestType: "log-teardown"
                    });
                    return waitAfterResolved();
                })
                .then(() => {

                    const [, [response]] = mockConnection.post.args.filter(([post]: [any]) => post.messageType === "response");
                    expect(response).to.exist;
                    expect(response).to.have.property("request");

                    const found = spy.find(LogPlugin)!;
                    expect(found).to.not.exist;
                });
        });

        it("should respond to 'pause'", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            expect(mockConnection.subscribe).to.have.property("callCount", 1);

            const [[next]] = mockConnection.subscribe.args;
            expect(next).to.have.be.a("function");

            next({
                match: "1",
                messageType: MESSAGE_REQUEST,
                postId: "0",
                postType: PANEL_MESSAGE,
                requestType: "pause"
            });

            return waitAfterResolved()
                .then(() => {

                    const [[response]] = mockConnection.post.args.filter(([post]: [any]) => post.messageType === "response");
                    expect(response).to.exist;
                    expect(response).to.have.property("request");
                    expect(response).to.have.property("pluginId", "0");

                    const found = spy.find(PausePlugin)!;
                    expect(found).to.exist;

                    next({
                        messageType: MESSAGE_REQUEST,
                        pluginId: "0",
                        postId: "1",
                        postType: PANEL_MESSAGE,
                        requestType: "pause-teardown"
                    });
                    return waitAfterResolved();
                })
                .then(() => {

                    const [, [response]] = mockConnection.post.args.filter(([post]: [any]) => post.messageType === "response");
                    expect(response).to.exist;
                    expect(response).to.have.property("request");

                    const found = spy.find(PausePlugin)!;
                    expect(found).to.not.exist;
                });
        });
    });
}

function waitAfterResolved(): Promise<void> {

    // Wait for another asychronous promise resolution so that the test is not
    // dependent upon the notification order - the internal post must occur
    // before the stub expectations are asserted.

    return Promise.resolve();
}
