/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { BehaviorSubject, noop, Observable } from "rxjs";
import { Auditor } from "./auditor";
import { Logger } from "./logger";
import {
    BufferPlugin,
    CyclePlugin,
    DevToolsPlugin,
    GraphPlugin,
    Plugin,
    PluginCtor,
    PluginOptions,
    SnapshotPlugin,
    StackTracePlugin,
    StatsPlugin
} from "./plugins";
import { Teardown } from "./teardown";

export class Host {

    readonly auditor: Auditor;
    readonly logger: Logger;
    readonly version: string;
    private plugins_: Plugin[];
    private pluginsSubject_: BehaviorSubject<Plugin[]>;
    private tick_: number;
    private undos_: Plugin[];

    constructor(options: {
        auditor: Auditor;
        defaultPlugins?: boolean,
        devTools?: boolean,
        logger: Logger;
        version: string;
    }) {
        const {
            auditor,
            defaultPlugins,
            devTools,
            logger,
            version
        } = options;

        this.auditor = auditor;
        this.logger = logger;
        this.version = version;
        this.tick_ = 0;
        this.undos_ = [];

        if (defaultPlugins ===  false) {
            this.plugins_ = [];
        } else {
            this.plugins_ = [
                new StackTracePlugin({ ...options, pluginHost: this }),
                new GraphPlugin({ ...options, pluginHost: this }),
                new SnapshotPlugin({ ...options, pluginHost: this }),
                new BufferPlugin({ ...options, pluginHost: this }),
                new CyclePlugin({ ...options, pluginHost: this }),
                new StatsPlugin({ pluginHost: this })
            ];
            if (devTools !==  false) {
                this.plugins_.push(new DevToolsPlugin({ pluginHost: this }));
            }
        }
        this.pluginsSubject_ = new BehaviorSubject(this.plugins_);
    }

    get plugins(): Observable<Plugin[]> {
        return this.pluginsSubject_.asObservable();
    }

    get tick(): number {
        return ++this.tick_;
    }

    get undos(): Plugin[] {
        return [...this.undos_];
    }

    findPlugins<P extends Plugin, O extends PluginOptions>(ctor: PluginCtor<P, O>, dependent?: PluginCtor<any, any>): P[] {
        const { plugins_ } = this;
        if (dependent && (plugins_.findIndex(plugin => plugin instanceof dependent) < plugins_.findIndex(plugin => plugin instanceof ctor))) {
            return [];
        }
        return plugins_.filter(plugin => plugin instanceof ctor) as P[];
    }

    notifyPlugins<T = void>({
        before = noop,
        beforeEach,
        between,
        afterEach,
        after = noop
    }: {
        before?: () => void,
        beforeEach: (plugin: Plugin) => void,
        between: () => T,
        afterEach: (plugin: Plugin, result: T) => void,
        after?: (result: T) => void
    }): T {
        const { plugins_ } = this;
        before();
        plugins_.forEach(beforeEach);
        const result = between();
        plugins_.forEach(plugin => afterEach(plugin, result));
        after(result);
        return result;
    }

    plug(...plugins: Plugin[]): Teardown {
        this.plugins_.push(...plugins);
        this.pluginsSubject_.next(this.plugins_);
        this.undos_.push(...plugins);
        return () => this.unplug(...plugins);
    }

    teardown(): void {
        this.plugins_.forEach(plugin => plugin.teardown());
        this.plugins_ = [];
        this.pluginsSubject_.next(this.plugins_);
        this.undos_ = [];
    }

    unplug(...plugins: Plugin[]): void {
        plugins.forEach(plugin => {
            if (this.plugins_.find(p => p === plugin)) {
                plugin.teardown();
                this.plugins_ = this.plugins_.filter(p => p !== plugin);
                this.pluginsSubject_.next(this.plugins_);
                this.undos_ = this.undos_.filter(u => u !== plugin);
            }
        });
    }
}
