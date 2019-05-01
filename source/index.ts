/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export { detect } from "./detect";
export { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
export { matches } from "./match";
export { BasePlugin, Plugin } from "./plugin";
export { create } from "./spy-factory";
export { inferPath, inferType } from "./util";

import { hide, tag } from "./operators";

import {
    CyclePlugin,
    DebugPlugin,
    GraphPlugin,
    LetPlugin,
    LogPlugin,
    PausePlugin,
    SnapshotPlugin,
    StackTracePlugin,
    StatsPlugin
} from "./plugin";

export const plugins = {
    CyclePlugin,
    DebugPlugin,
    GraphPlugin,
    LetPlugin,
    LogPlugin,
    PausePlugin,
    SnapshotPlugin,
    StackTracePlugin,
    StatsPlugin
};

export const operators = {
    hide,
    tag
};
