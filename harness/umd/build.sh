#!/bin/sh
yarn dist
mkdir -p bundles
cp ../../node_modules/core-js/client/core.min.* bundles/
cp ../../node_modules/rxjs/bundles/rxjs.umd.* bundles/
cp ../../dist/bundles/rxjs-spy.umd.* bundles/
