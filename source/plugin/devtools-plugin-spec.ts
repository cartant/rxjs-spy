/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs/Subject";
import * as sinon from "sinon";
import { BATCH_MILLISECONDS, EXTENSION_KEY, MESSAGE_REQUEST, PANEL_MESSAGE } from "../devtools/constants";
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
            spy.plug(
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
            return waitAfterSnapshot()
                .then(() => {

                    expect(mockConnection.post).to.have.property("callCount", 1);

                    const [args] = mockConnection.post.args;
                    const [batch] = args;
                    expect(batch).to.have.property("messages");
                    expect(batch.messages.map((m: any) => m.notification.type)).to.deep.equal([
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

            const person: any = { name: "alice", employer: undefined };
            person.employer = person;

            subject.next(person);

            const snapshot = snapshotPlugin.snapshotAll();
            return waitAfterSnapshot()
                .then(() => {

                    expect(mockConnection.post).to.have.property("callCount", 1);

                    const [args] = mockConnection.post.args;
                    const [batch] = args;
                    expect(batch).to.have.property("messages");
                    expect(batch.messages.map((m: any) => m.notification.type)).to.deep.equal([
                        "before-subscribe",
                        "after-subscribe",
                        "before-next"
                    ]);

                    const { messages: [,, { notification }] } = batch;
                    expect(notification).to.have.property("value");
                    expect(notification.value).to.have.property("json");
                    expect(notification.value.json).to.match(/"name":\s*"alice"/);
                    expect(notification.value.json).to.match(/"employer":\s*"\[Circular\]"/);
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
            return waitAfterSnapshot()
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
                messageType: MESSAGE_REQUEST,
                postId: "0",
                postType: PANEL_MESSAGE,
                requestType: "log",
                spyId: "1"
            });

            return waitAfterSnapshot()
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
                    return waitAfterSnapshot();
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
                messageType: MESSAGE_REQUEST,
                postId: "0",
                postType: PANEL_MESSAGE,
                requestType: "pause",
                spyId: "1"
            });

            return waitAfterSnapshot()
                .then(() => {

                    const [[response]] = mockConnection.post.args.filter(([post]: [any]) => post.messageType === "response");
                    expect(response).to.exist;
                    expect(response).to.have.property("request");
                    expect(response).to.have.property("pluginId", "0");

                    const found = spy.find(PausePlugin)!;
                    expect(found).to.exist;

                    next({
                        command: "resume",
                        messageType: MESSAGE_REQUEST,
                        pluginId: "0",
                        postId: "1",
                        postType: PANEL_MESSAGE,
                        requestType: "pause-command"
                    });
                    return waitAfterSnapshot();
                })
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
                        postId: "2",
                        postType: PANEL_MESSAGE,
                        requestType: "pause-teardown"
                    });
                    return waitAfterSnapshot();
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

function waitAfterSnapshot(): Promise<void> {

    // Notifications are posted to the DevTools in batches, so that large
    // numbers of high-frequency observables won't overload the connection.

    return new Promise((resolve) => setTimeout(resolve, BATCH_MILLISECONDS + 10));
}
