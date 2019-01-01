#!/bin/sh
yarn dist
../../node_modules/.bin/webpack --config ./webpack.config.js
