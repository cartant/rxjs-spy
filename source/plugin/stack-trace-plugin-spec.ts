/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs";
import { map } from "rxjs/operators";
import { create } from "../factory";
import { Spy } from "../spy";
import { StackTracePlugin } from "./stack-trace-plugin";
import { SubscriptionRecordsPlugin } from "./subscription-records-plugin";

describe("StackTracePlugin", () => {

    let spy: Spy;
    let stackTracePlugin: StackTracePlugin;
    let subscriptionRecordsPlugin: SubscriptionRecordsPlugin;

    beforeEach(() => {

        spy = create({ defaultPlugins: false, warning: false });
        stackTracePlugin = new StackTracePlugin({ pluginHost: spy.pluginHost });
        subscriptionRecordsPlugin = new SubscriptionRecordsPlugin({ pluginHost: spy.pluginHost });
        spy.pluginHost.plug(stackTracePlugin, subscriptionRecordsPlugin);
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

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
