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