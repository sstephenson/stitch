exports.a = require("./a");
exports.custom = require("../custom_exports");
exports.baz = require("../foo/bar/baz").baz;
exports.buz = require("../foo/bar/../buz").buz;
