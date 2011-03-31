(function() {
  var Package;
  exports.compilers = require('./compilers');
  exports.Package = Package = require('./package');
  exports.createPackage = function(config) {
    return new Package(config);
  };
}).call(this);
