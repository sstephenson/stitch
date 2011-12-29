A = require('./using_module_exports_a');

module.exports = {
  b: function() {
    return A.a()
  }
};
