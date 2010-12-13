(function() {
  var CoffeeScript, Package, async, defaultCompilers, extname, fs, join, normalize, _, _ref;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  _ = require('underscore');
  async = require('async');
  fs = require('fs');
  _ref = require('path'), extname = _ref.extname, join = _ref.join, normalize = _ref.normalize;
  defaultCompilers = {
    js: function(module, filename) {
      var content;
      content = fs.readFileSync(filename, 'utf8');
      return module._compile(content, filename);
    }
  };
  try {
    CoffeeScript = require('coffee-script');
    defaultCompilers.coffee = function(module, filename) {
      var content;
      content = CoffeeScript.compile(fs.readFileSync(filename, 'utf8'));
      return module._compile(content, filename);
    };
  } catch (err) {

  }
  exports.Package = Package = function() {
    function Package(config) {
      this.identifier = config.identifier || 'require';
      this.paths = config.paths || ['lib'];
      this.compilers = _.extend({}, defaultCompilers, config.compilers);
      this.cache = config.cache || true;
      this.mtimeCache = {};
      this.compileCache = {};
    }
    Package.prototype.compile = function(callback) {
      return async.reduce(this.paths, {}, this.gatherSourcesFromPath.bind(this), __bind(function(err, sources) {
        var filename, index, name, result, source, _ref;
        if (err) {
          return callback(err);
        }
        result = "var " + this.identifier + " = (function(modules) {\n  var exportCache = {};\n  return function require(name) {\n    var module = exportCache[name];\n    var fn;\n    if (module) {\n      return module;\n    } else if (fn = modules[name]) {\n      module = { id: name, exports: {} };\n      fn(module.exports, require, module);\n      exportCache[name] = module.exports;\n      return module.exports;\n    } else {\n      throw 'module \\'' + name + '\\' not found';\n    }\n  }\n})({";
        index = 0;
        for (name in sources) {
          _ref = sources[name], filename = _ref.filename, source = _ref.source;
          result += index++ === 0 ? "" : ", ";
          result += JSON.stringify(name);
          result += ": function(exports, require, module) {" + source + "}";
        }
        result += "});\n";
        return callback(err, result);
      }, this));
    };
    Package.prototype.createServer = function() {
      return __bind(function(req, res, next) {
        return this.compile(function(err, source) {
          var message;
          if (err) {
            console.error("" + err.stack);
            message = "" + err.stack;
            res.writeHead(500, {
              'Content-Type': 'text/javascript'
            });
            return res.end("throw " + (JSON.stringify(message)));
          } else {
            res.writeHead(200, {
              'Content-Type': 'text/javascript'
            });
            return res.end(source);
          }
        });
      }, this);
    };
    Package.prototype.gatherSourcesFromPath = function(sources, sourcePath, callback) {
      return fs.stat(sourcePath, __bind(function(err, stat) {
        if (err) {
          return callback(err);
        }
        if (stat.isDirectory()) {
          return this.getFilesInTree(sourcePath, __bind(function(err, paths) {
            if (err) {
              return callback(err);
            }
            return async.reduce(paths, sources, this.gatherCompilableSource.bind(this), callback);
          }, this));
        } else {
          return this.gatherCompilableSource(sources, sourcePath, callback);
        }
      }, this));
    };
    Package.prototype.gatherCompilableSource = function(sources, path, callback) {
      if (this.compilers[extname(path).slice(1)]) {
        return this.getRelativePath(path, __bind(function(err, relativePath) {
          if (err) {
            return callback(err);
          }
          return this.compileFile(path, function(err, source) {
            var extension, key;
            if (err) {
              return callback(err);
            } else {
              extension = extname(relativePath);
              key = relativePath.slice(0, -extension.length);
              sources[key] = {
                filename: relativePath,
                source: source
              };
              return callback(err, sources);
            }
          });
        }, this));
      } else {
        return callback(null, sources);
      }
    };
    Package.prototype.getRelativePath = function(path, callback) {
      path = normalize(path);
      return async.map(this.paths, fs.realpath, function(err, expandedPaths) {
        var base, expandedPath, _i, _len;
        if (err) {
          return callback(err);
        }
        for (_i = 0, _len = expandedPaths.length; _i < _len; _i++) {
          expandedPath = expandedPaths[_i];
          base = expandedPath + "/";
          if (path.indexOf(base) === 0) {
            return callback(null, path.slice(base.length));
          }
        }
        return callback("" + path + " isn't in the require path");
      });
    };
    Package.prototype.compileFile = function(path, callback) {
      var compile, err, extension, mod, mtime, source;
      extension = extname(path).slice(1);
      if (this.cache && this.compileCache[path] && this.mtimeCache[path] === this.compileCache[path].mtime) {
        return callback(null, this.compileCache[path].source);
      } else if (compile = this.compilers[extension]) {
        source = null;
        mod = {
          _compile: function(content, filename) {
            return source = content;
          }
        };
        try {
          compile(mod, path);
          if (this.cache && (mtime = this.mtimeCache[path])) {
            this.compileCache[path] = {
              mtime: mtime,
              source: source
            };
          }
          return callback(null, source);
        } catch (err) {
          if (err instanceof Error) {
            err.message = "can't compile " + path + "\n" + err.message;
          } else {
            err = new Error("can't compile " + path + "\n" + err);
          }
          return callback(err);
        }
      } else {
        return callback("no compiler for '." + extension + "' files");
      }
    };
    Package.prototype.walkTree = function(directory, callback) {
      return fs.readdir(directory, __bind(function(err, files) {
        if (err) {
          return callback(err);
        }
        return async.forEach(files, __bind(function(file, next) {
          var filename;
          if (file.match(/^\./)) {
            return next();
          }
          filename = join(directory, file);
          return fs.stat(filename, __bind(function(err, stats) {
            var _ref;
            this.mtimeCache[filename] = stats != null ? (_ref = stats.mtime) != null ? _ref.toString() : void 0 : void 0;
            if (!err && stats.isDirectory()) {
              return this.walkTree(filename, function(err, filename) {
                if (filename) {
                  return callback(err, filename);
                } else {
                  return next();
                }
              });
            } else {
              callback(err, filename);
              return next();
            }
          }, this));
        }, this), callback);
      }, this));
    };
    Package.prototype.getFilesInTree = function(directory, callback) {
      var files;
      files = [];
      return this.walkTree(directory, function(err, filename) {
        if (err) {
          return callback(err);
        } else if (filename) {
          return files.push(filename);
        } else {
          return callback(err, files.sort());
        }
      });
    };
    return Package;
  }();
  exports.createPackage = function(config) {
    return new Package(config);
  };
}).call(this);
