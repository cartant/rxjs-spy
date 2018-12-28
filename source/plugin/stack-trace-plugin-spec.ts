/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs";
import { map } from "rxjs/operators";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { StackTracePlugin } from "./stack-trace-plugin";
import { SubscriptionLabelsPlugin } from "./subscription-labels-plugin";

describe("StackTracePlugin", () => {

    let spy: Spy;
    let stackTracePlugin: StackTracePlugin;
    let subscriptionLabelsPlugin: SubscriptionLabelsPlugin;

    beforeEach(() => {

        spy = create({ defaultPlugins: false, warning: false });
        stackTracePlugin = new StackTracePlugin({ spy });
        subscriptionLabelsPlugin = new SubscriptionLabelsPlugin({ spy });
        spy.plug(stackTracePlugin, subscriptionLabelsPlugin);
    });

    it("should determine the stack traces", () => {

        const subject = new Subject<number>();
        const mapped = subject.pipe(map(value => value));
        mapped.subscribe();

        const subjectSubscription = subscriptionLabelsPlugin.getSubscription(subject);
        const mappedSubscription = subscriptionLabelsPlugin.getSubscription(mapped);

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
