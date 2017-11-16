/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs/Subject";
import * as sinon from "sinon";
import { EXTENSION_KEY } from "../devtools/constants";
import { Connection, Extension } from "../devtools/interfaces";
import { DevToolsPlugin } from "./devtools-plugin";
import { GraphPlugin } from "./graph-plugin";
import { SnapshotPlugin } from "./snapshot-plugin";
import { plugin, spy } from "../spy";
import { StackTracePlugin } from "./stack-trace-plugin";

if (typeof window !== "undefined") {

    describe("DevToolsPlugin", () => {

        let mockConnection: any;
        let mockExtension: any;
        let snapshotPlugin: SnapshotPlugin;
        let teardown: () => void;

        afterEach(() => {

            if (teardown) {
                teardown();
            }
            expect(mockExtension.connect).to.have.property("callCount", 1);
            expect(mockConnection.disconnect).to.have.property("callCount", 1);

            window[EXTENSION_KEY] = undefined;
        });

        beforeEach(() => {

            mockConnection = {
                disconnect: sinon.stub(),
                post: sinon.stub().returns(""),
                subscribe: sinon.stub()
            };
            mockExtension = {
                connect: sinon.stub().returns(mockConnection)
            };
            window[EXTENSION_KEY] = mockExtension;

            snapshotPlugin = new SnapshotPlugin({ keptValues: 1 });
            teardown = spy({ plugins: [
                new StackTracePlugin(),
                new GraphPlugin({ keptDuration: -1 }),
                snapshotPlugin,
                new DevToolsPlugin()
            ], warning: false });
        });

        it("should post notification messages", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            subject.next(1);
            subject.complete();

            const promises: Promise<void>[] = [];
            const snapshot = snapshotPlugin.snapshotAll();
            snapshot.subscriptions.forEach(snapshot => promises.push(snapshot.sourceMapsResolved));

            return Promise.all(promises).then(() => {

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

            const promises: Promise<void>[] = [];
            const snapshot = snapshotPlugin.snapshotAll();
            snapshot.subscriptions.forEach(snapshot => promises.push(snapshot.sourceMapsResolved));

            return Promise.all(promises).then(() => {

                expect(mockConnection.post).to.have.property("callCount", 3);
                expect(mockConnection.post.args.map(([message]: [any]) => message.notification)).to.deep.equal([
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
    });
}
