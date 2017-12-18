<a name="6.1.0"></a>
## [6.1.0](https://github.com/cartant/rxjs-spy/compare/v6.0.0...v6.1.0) (2017-12-18)

Fixes:

* When `sourceMaps` are enabled, memory usage has been hugely reduced. The resolution of the stack traces using source maps is now deferred and is wrapped in an observable.

Features:

* Subscription snapshots now include a `mappedStackTrace` observable that resolves a stack trace (if `sourceMaps` is enabled).
* The `show` command now limits the maximum number of observables that can be logged to the console.

<a name="6.0.0"></a>
## [6.0.0](https://github.com/cartant/rxjs-spy/compare/v5.2.3...v6.0.0) (2017-12-07)

Breaking changes:

* The module API has been replaced with a factory and a class/interface. Instead of calling a `spy` method, call `create` which will return a instance that implements the `Spy` interface.
* The `plugins` option has been removed and `defaultPlugins: boolean` has been added.
* The `plugin` and `plugins` methods have changed. When using `defaultPlugins: false`, call `plug` on the spy instance to add one or more plugins.
* The `name` parameter has been removed from the `plugin`/`plug` method.
* A read-only `name` property has been added to the `Plugin` interface.
* The `subscribers` map has been removed from the `observable` snapshot and replaced with a `subscriptions` map.
* In the snapshots, `merges` has been renamed to `flattenings`.
* It's no longer possible to undo the entire spy via the console.
* The console global - `rxSpy` - won't exist until `create` has been called.
* `undefined` is favoured for return values, etc. rather than `null`.

Fixes:

* When calling `show`, `console.error` is no longer used for the unsubscribed indicator.
* For memory reasons, raw snapshots, etc. are no longer logged to the console when calling `show` or `log`.
* For performance reasons, grouping has been removed from `log` messages.
* Patching of `Observable.prototype` has been removed.
* The `GraphPlugin` now uses a single `setInterval` when cleaning up unsubscribed subscription refs.

Non-breaking changes:

* Switched to Webpack.

Features:

* When logging, if the observable does not have a tag, its type is logged instead.
* Options have been added to the `LetPlugin` so that completions from the selected observable can be ignored - so it's possible to return something like `Observable.of(42)` without having the spied-upon observable complete.
* The `DevTools` plugin has been added (for integration with an almost-ready-for-RC Chrome DevTools extension).
* It's now possible to match IDs as well as tags (it's used by the DevTools extension).
* The output from `show` now includes the observable's 'path' - a string representation of the composed source and operators.
* A `hide` operator has been added and can be used to ensure a composed observable is hidden from the spy.
* An `audit` option has been added to the spy and can be used to audit logged notifications within the specified number of milliseconds - so that logging high-frequency observables will not overwhelm the console.

<a name="5.2.3"></a>
## [5.2.3](https://github.com/cartant/rxjs-spy/compare/v5.2.2...v5.2.3) (2017-11-24)

### Fixes

* Fix a bug that occurred when logging if the `GraphPlugin` was enabled without the `SnapshotPlugin`. ([970e184](https://github.com/cartant/rxjs-spy/commit/970e184))

<a name="5.2.2"></a>
## [5.2.2](https://github.com/cartant/rxjs-spy/compare/v5.2.1...v5.2.2) (2017-11-23)

### Fixes

* Remove raw snapshots and observables from console logs to avoid leaking memory. ([756b32d](https://github.com/cartant/rxjs-spy/commit/756b32d))

<a name="5.2.1"></a>
## [5.2.1](https://github.com/cartant/rxjs-spy/compare/v5.2.0...v5.2.1) (2017-11-08)

### Fixes

* Fix publishing from `next` fiasco.

<a name="5.2.0"></a>
## [5.2.0](https://github.com/cartant/rxjs-spy/compare/v5.1.1...v5.2.0) (2017-11-08)

### Features

* **Stats**: Add graph-related stats (included only if the `GraphPlugin` is configured). ([c377506](https://github.com/cartant/rxjs-spy/commit/c377506))

<a name="5.1.1"></a>
## [5.1.1](https://github.com/cartant/rxjs-spy/compare/v5.1.0...v5.1.1) (2017-11-07)

### Changes

* The `sourceMaps` option now defaults to `false`.

<a name="5.1.0"></a>
## [5.1.0](https://github.com/cartant/rxjs-spy/compare/v5.0.0...v5.1.0) (2017-11-07)

### Features

* **Stats**: Add a plugin to collect basic stats. ([a49344c](https://github.com/cartant/rxjs-spy/commit/a49344c))

<a name="5.0.0"></a>
## [5.0.0](https://github.com/cartant/rxjs-spy/compare/v4.1.2...v5.0.0) (2017-11-02)

### Features

* If non-`Error` instance values are passed in an `error` notification, a warning is logged to the console.

### Breaking Changes

No breaking changes to the module or console APIs, but the `SnapshotPlugin` and the snapshots have changed. In particular:

* `flush` has been removed from `SnapshotPlugin`. The flushing mechanism has been simplified and delegated entirely to the `GraphPlugin`. Flushing is now fully automatic and is controlled by the `keptDuration` option that can be passed to `spy`.
* `destination` and `rootDestination` have been renamed to `sink` and `rootSink`.

Also, the `DevToolsPlugin` has been removed and moved to the `next` branch, as it is a work in progress.

<a name="4.1.2"></a>
## [4.1.2](https://github.com/cartant/rxjs-spy/compare/v4.1.1...v4.1.2) (2017-11-01)

### Fixes

* Upgrade to TypeScript 2.6. ([570b915](https://github.com/cartant/rxjs-spy/commit/570b915))

<a name="4.1.1"></a>
## [4.1.1](https://github.com/cartant/rxjs-spy/compare/v4.1.0...v4.1.1) (2017-10-31)

### Fixes

* Add support for the `keptDuration` option to the `GraphPlugin`. ([b048d38](https://github.com/cartant/rxjs-spy/commit/b048d38))

    Now, when source or merged subscriptions complete or error, they should be removed from the destination subscription's graph and counters should be incremented to indicate that flushing has occurred. In short, `rxjs-spy` should no longer contintually consume memory (unless `keptDuration` is set to `-1`).

<a name="4.1.0"></a>
## [4.1.0](https://github.com/cartant/rxjs-spy/compare/v4.0.0...v4.1.0) (2017-10-31)

### Features

* Allow plugin options to be passed to [`spy`](https://github.com/cartant/rxjs-spy#spy).
* Add the `sourceMaps` option for the `StackTracePlugin`. ([3bd322e](https://github.com/cartant/rxjs-spy/commit/3bd322e))
* Add the `keptDuration` option for the `SnapshotPlugin`. ([723de5b](https://github.com/cartant/rxjs-spy/commit/723de5b))

<a name="4.0.0"></a>
## [4.0.0](https://github.com/cartant/rxjs-spy/compare/v3.1.4...v4.0.0) (2017-10-23)

### Features

* A lettable/pipeable `tag` operator has been added (under the `operators` directory);
* `find`, `findAll` and `detect` methods have been added; and
* source maps are now used when obtaining stack traces.

### Breaking Changes

No breaking changes to the module or console APIs, but the `Plugin` interface and the snapshots have changed. In particular:

* `complete` and `error` have been moved from the observable snapshot to the subscription snapshot;
* snapshots no longer include the `ref`; and
* `finalDestination` has been renamed to `rootDestination`.

<a name="3.1.4"></a>
## [3.1.4](https://github.com/cartant/rxjs-spy/compare/v3.1.3...v3.1.4) (2017-08-08)

### Minor Changes

* **Logging:** Only `show` subscribers can have multiple relevant subscriptions; `log` subscribers will have only one relevant subscription. ([38d792c](https://github.com/cartant/rxjs-spy/commit/38d792c))

<a name="3.1.3"></a>
## [3.1.3](https://github.com/cartant/rxjs-spy/compare/v3.1.2...v3.1.3) (2017-08-02)

### Bug Fixes

* **Logging:** Don't call `toString` on `null`, etc. and don't include the value in the group name. ([6000e24](https://github.com/cartant/rxjs-spy/commit/6000e24))

<a name="3.1.2"></a>
## [3.1.2](https://github.com/cartant/rxjs-spy/compare/v3.1.1...v3.1.2) (2017-08-01)

### Features

* **Stack traces:** Default to no source maps. ([20dbeaa](https://github.com/cartant/rxjs-spy/commit/20dbeaa))

<a name="3.1.1"></a>
## [3.1.1](https://github.com/cartant/rxjs-spy/compare/v3.1.0...v3.1.1) (2017-08-01)

### Bug Fixes

* **Dependencies:** `@types/stacktrace-js` is a non-dev dependency. ([2597fb0](https://github.com/cartant/rxjs-spy/commit/2597fb0))

<a name="3.1.0"></a>
## [3.1.0](https://github.com/cartant/rxjs-spy/compare/v3.0.0...v3.1.0) (2017-08-01)

### Features

* **Stack traces:** Resolve source maps. ([78f2b56](https://github.com/cartant/rxjs-spy/commit/78f2b56))

### Bug Fixes

* **Dependencies:** `stacktrace-js` is a non-dev dependency. ([28988ef](https://github.com/cartant/rxjs-spy/commit/28988ef))

<a name="3.0.0"></a>
## [3.0.0](https://github.com/cartant/rxjs-spy/compare/v2.1.0...v3.0.0) (2017-07-27)

### Breaking Changes

No breaking changes to the module or console APIs, but the plugin interface and the snapshots have changed - the changes account for subscribers being able to have multiple subscriptions.

* **Snapshots**: Include subscription on stack. ([6a270e4](https://github.com/cartant/rxjs-spy/commit/6a270e4))
* **Snapshots**: Rename snapshots. ([f3d1992](https://github.com/cartant/rxjs-spy/commit/f3d1992))
* **Plugin**: Add SubscriptionRef. ([953260d](https://github.com/cartant/rxjs-spy/commit/953260d))
* **Snapshots**: Separate records/snapshots. ([fd04a76](https://github.com/cartant/rxjs-spy/commit/fd04a76))

<a name="2.1.0"></a>
## [2.1.0](https://github.com/cartant/rxjs-spy/compare/v2.0.0...v2.1.0) (2017-07-24)

### Features

* **Stack traces:** Include `subscribe` stack traces in `log` and `show` output. ([d7abd57](https://github.com/cartant/rxjs-spy/commit/d7abd57) and [ec926ad](https://github.com/cartant/rxjs-spy/commit/ec926ad))

<a name="2.0.0"></a>
## [2.0.0](https://github.com/cartant/rxjs-spy/compare/v1.0.1...v2.0.0) (2017-07-19)

### Breaking Changes

* **Snapshots:** Remove values from observable snapshots; only store values against subscriptions. ([48f7483](https://github.com/cartant/rxjs-spy/commit/48f7483))
* **Plugin events:** Rename plugin events to notifications. ([6018d38](https://github.com/cartant/rxjs-spy/commit/6018d38))