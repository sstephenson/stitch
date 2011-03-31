(function() {
  var CoffeeScript, eco, fs;
  fs = require('fs');
  exports.js = function(module, filename) {
    var content;
    content = fs.readFileSync(filename, 'utf8');
    return module._compile(content, filename);
  };
  try {
    CoffeeScript = require('coffee-script');
    exports.coffee = function(module, filename) {
      var content;
      content = CoffeeScript.compile(fs.readFileSync(filename, 'utf8'));
      return module._compile(content, filename);
    };
  } catch (err) {

  }
  try {
    eco = require('eco');
    exports.eco = function(module, filename) {
      var content;
      content = eco.compile(fs.readFileSync(filename, 'utf8'));
      return module._compile(content, filename);
    };
  } catch (err) {

  }
}).call(this);
