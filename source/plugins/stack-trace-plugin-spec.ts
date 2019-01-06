/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs";
import { map } from "rxjs/operators";
import { patch } from "../factory";
import { Patcher } from "../patcher";
import { StackTracePlugin } from "./stack-trace-plugin";
import { SubscriptionRecordsPlugin } from "./subscription-records-plugin";

describe("StackTracePlugin", () => {

    let patcher: Patcher;
    let stackTracePlugin: StackTracePlugin;
    let subscriptionRecordsPlugin: SubscriptionRecordsPlugin;

    beforeEach(() => {

        patcher = patch({ defaultPlugins: false, warning: false });
        stackTracePlugin = new StackTracePlugin({ pluginHost: patcher.pluginHost });
        subscriptionRecordsPlugin = new SubscriptionRecordsPlugin({ pluginHost: patcher.pluginHost });
        patcher.pluginHost.plug(stackTracePlugin, subscriptionRecordsPlugin);
    });

    it("should determine the stack traces", () => {

        const subject = new Subject<number>();
        const mapped = subject.pipe(map(value => value));
        mapped.subscribe();

        const subjectSubscription = subscriptionRecordsPlugin.getSubscription(subject);
        const mappedSubscription = subscriptionRecordsPlugin.getSubscription(mapped);

        const subjectStackTrace = stackTracePlugin.getStackTrace(subjectSubscription);
        const mappedStackTrace = stackTracePlugin.getStackTrace(mappedSubscription);

        expect(subjectStackTrace).to.exist;
        expect(subjectStackTrace).to.not.be.empty;

        expect(mappedStackTrace).to.exist;
        expect(mappedStackTrace).to.not.be.empty;
    });

    it("should add name records to observables", () => {

        const subject = new Subject<number>();
        const mapped = subject.pipe(map(value => value));
        mapped.subscribe();

        const subjectNameRecord = stackTracePlugin.getNameRecord(subject);
        const mappedNameRecord = stackTracePlugin.getNameRecord(mapped);

        expect(subjectNameRecord).to.deep.equal({
            observableName: "subject",
            operatorName: undefined
        });
        expect(mappedNameRecord).to.deep.equal({
            observableName: "map",
            operatorName: "map"
        });
    });

    afterEach(() => {

        if (patcher) {
            patcher.teardown();
        }
    });
});
