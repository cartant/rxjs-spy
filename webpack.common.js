// https://webpack.github.io/docs/configuration.html#externals

const path = require("path");

exports.alias = {
    "rxjs/operator/let$": path.resolve(__dirname, "source/let")
};

exports.externals = [
    (context, request, callback) => {
        if(/^rxjs\/symbol\/rxSubscriber/.test(request)) {
            callback(null, "var Rx.Symbol");
        } else if(/^rxjs\/\w+$/.test(request)) {
            callback(null, "var Rx");
        } else if(/^rxjs\/operator\/let$/.test(request)) {
            callback(null, false);
        } else if(/^rxjs\/operator\/\w+$/.test(request)) {
            callback(null, "var Rx.Observable.prototype");
        } else if(/^rxjs\/add/.test(request)) {
            callback(null, "var Rx.unused");
        } else {
            callback();
        }
    }
];
