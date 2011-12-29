var B;

module.exports = {
  a: function() {
    return 'a';
  },
  b: function() {
    return B.b()
  }
};

B = require('./using_module_exports_b');
