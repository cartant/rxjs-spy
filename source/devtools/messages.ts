/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export const CONTENT_BACKGROUND_CONNECT = "content-background-connect";
export const CONTENT_MESSAGE = "content-message";
export const MESSAGE_BATCH = "batch";
export const MESSAGE_BROADCAST = "broadcast";
export const MESSAGE_CONNECT = "connect";
export const MESSAGE_DISCONNECT = "disconnect";
export const MESSAGE_REQUEST = "request";
export const MESSAGE_RESPONSE = "response";
export const PANEL_BACKGROUND_CONNECT = "panel-background-connect";
export const PANEL_BACKGROUND_INIT = "panel-background-init";
export const PANEL_MESSAGE = "panel-message";

export interface Message {
    [key: string]: any;
    messageType: string;
}

export interface Batch extends Message {
    [key: string]: any;
    messages: Message[];
    messageType: "batch";
}

export interface Broadcast extends Message {
    [key: string]: any;
    broadcastType: string;
    messageType: "broadcast";
}

export interface Post extends Message {
    [key: string]: any;
    postId: string;
    postType: string;
}

export interface Request extends Message {
    [key: string]: any;
    messageType: "request";
    requestType: string;
}

export interface Response extends Message {
    [key: string]: any;
    error?: string;
    messageType: "response";
    request: Post & Request;
}

export function isBatch(message: Message): message is Batch {
    return message.messageType === MESSAGE_BATCH;
}

export function isBroadcast(message: Message): message is Broadcast {
    return message.messageType === MESSAGE_BROADCAST;
}

export function isPost(message: Message): message is Post {
    return message["postType"] !== undefined;
}

export function isPostRequest(message: Message): message is Post & Request {
    return isPost(message) && (message.messageType === MESSAGE_REQUEST);
}

export function isPostResponse(message: Message): message is Post & Response {
    return isPost(message) && (message.messageType === MESSAGE_RESPONSE);
}

export function isRequest(message: Message): message is Request {
    return message.messageType === MESSAGE_REQUEST;
}

export function isResponse(message: Message): message is Response {
    return message.messageType === MESSAGE_RESPONSE;
}
