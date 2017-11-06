/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { SubscriptionRef } from "./plugin";
import { getStackTrace, StackTracePlugin } from "./stack-trace-plugin";
import { SubscriberRefsPlugin } from "./subscriber-refs-plugin";
import { spy } from "../spy";

import "rxjs/add/operator/map";

describe("StackTracePlugin", () => {

    let stackTracePlugin: StackTracePlugin;
    let subscriberRefsPlugin: SubscriberRefsPlugin;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        stackTracePlugin = new StackTracePlugin();
        subscriberRefsPlugin = new SubscriberRefsPlugin();
        teardown = spy({ plugins: [stackTracePlugin, subscriberRefsPlugin], warning: false });
    });

    it("should determine the stack traces", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const subscription = mapped.subscribe();

        const subjectSubscriptionRef = subscriberRefsPlugin.get(subject);
        const mappedSubscriptionRef = subscriberRefsPlugin.get(mapped);

        const subjectStackTrace = getStackTrace(subjectSubscriptionRef);
        const mappedStackTrace = getStackTrace(mappedSubscriptionRef);

        expect(subjectStackTrace).to.exist;
        expect(subjectStackTrace).to.not.be.empty;

        expect(mappedStackTrace).to.exist;
        expect(mappedStackTrace).to.not.be.empty;
    });
});
