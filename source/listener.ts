/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { tagged } from "./operator/tag";
import { emptyPlugin, Plugin } from "./plugin";
import { attach, detach } from "./spy";

export type ListenerEventType =
    "afterComplete" |
    "afterError" |
    "afterNext" |
    "afterSubscribe" |
    "afterUnsubscribe" |
    "beforeComplete" |
    "beforeError" |
    "beforeNext" |
    "beforeSubscribe" |
    "beforeUnsubscribe";

export interface ListenerEvent {
    error?: any;
    observable: Observable<any>;
    subscriber: Subscriber<any>;
    type: ListenerEventType;
    value?: any;
}

export type ListenerEventHandler = (event: ListenerEvent) => void;

export class Listener {

    private handlers_: { [type: string]: ListenerEventHandler[] } = {};
    private match_: any;
    private plugin_: Plugin;

    constructor(match: string);
    constructor(match: RegExp);
    constructor(match: (tag: string) => boolean);
    constructor(match: any) {

        this.plugin_ = emptyPlugin();
        this.plugin_.afterComplete = (observable, subscriber) => this.handle_({ observable, subscriber, type: "afterComplete" });
        this.plugin_.afterError = (observable, subscriber, error) => this.handle_({ error, observable, subscriber, type: "afterError" });
        this.plugin_.afterNext = (observable, subscriber, value) => this.handle_({ observable, subscriber, type: "afterNext", value });
        this.plugin_.afterSubscribe = (observable, subscriber) => this.handle_({ observable, subscriber, type: "afterSubscribe" });
        this.plugin_.afterUnsubscribe = (observable, subscriber) => this.handle_({ observable, subscriber, type: "afterUnsubscribe" });
        this.plugin_.beforeComplete = (observable, subscriber) => this.handle_({ observable, subscriber, type: "beforeComplete" });
        this.plugin_.beforeError = (observable, subscriber, error) => this.handle_({ error, observable, subscriber, type: "beforeError" });
        this.plugin_.beforeNext = (observable, subscriber, value) => this.handle_({ observable, subscriber, type: "beforeNext", value });
        this.plugin_.beforeSubscribe = (observable, subscriber) => this.handle_({ observable, subscriber, type: "beforeSubscribe" });
        this.plugin_.beforeUnsubscribe = (observable, subscriber) => this.handle_({ observable, subscriber, type: "beforeUnsubscribe" });
        this.attach(match);
    }

    attach(match: string): void;
    attach(match: RegExp): void;
    attach(match: (tag: string) => boolean): void;
    attach(match: any): void {

        this.match_ = match;
        attach(this.plugin_);
    }

    detach(): void {

        detach(this.plugin_);
        this.match_ = null;
    }

    off(type?: ListenerEventType, handler?: ListenerEventHandler): void {

        if (type === undefined) {
            this.handlers_ = {};
        } else if (handler === undefined) {
            this.handlers_[type] = [];
        } else {
            const handlers = this.handlers_[type] || [];
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    on(type: ListenerEventType, handler: ListenerEventHandler): ListenerEventHandler {

        let handlers = this.handlers_[type];
        if (handlers === undefined) {
            this.handlers_[type] = handlers = [];
        }
        handlers.push(handler);

        return handler;
    }

    private handle_(event: ListenerEvent): void {

        const { observable, type } = event;
        if (tagged(observable, this.match_)) {
            const handlers = this.handlers_[type] || [];
            handlers.forEach((handler) => handler(event));
        }
    }
}
