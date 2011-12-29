var a = require("./using_exports_a");
exports.b = function() {
  return a.a();
}
