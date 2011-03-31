(function() {
  var Package, createPackage;
  exports.Package = Package = require('./package');
  exports.createPackage = createPackage = function(config) {
    return new Package(config);
  };
  exports.compilers = require('./compilers');
  exports.compile = function(config, callback) {
    return createPackage(config).compile(callback);
  };
  exports.compiler = function(config) {
    return function(req, res, next) {
      return compile(config, function(err, source) {
        var message;
        if (err) {
          message = "" + err.stack;
          res.writeHead(500, {
            "Content-Type": "text/javascript"
          });
          return res.end("throw " + (JSON.stringify(message)));
        } else {
          res.writeHead(200, {
            "Content-Type": "text/javascript"
          });
          return res.end(source);
        }
      });
    };
  };
}).call(this);
