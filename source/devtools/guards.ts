/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Message, Notification, Post, Request, Response } from "./interfaces";

export function isNotification(message: Message): message is Notification {
    return message.messageType === "notification";
}

export function isPost(message: Message): message is Post {
    return message["postType"] !== undefined;
}

export function isRequest(message: Message): message is Request {
    return message.messageType === "request";
}

export function isResponse(message: Message): message is Response {
    return message.messageType === "response";
}
