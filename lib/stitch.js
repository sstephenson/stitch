(function() {
  var CoffeeScript, Package, async, compilers, eco, extname, fs, join, normalize, _, _ref;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  _ = require('underscore');

  async = require('async');

  fs = require('fs');

  _ref = require('path'), extname = _ref.extname, join = _ref.join, normalize = _ref.normalize;

  exports.compilers = compilers = {
    js: function(module, filename) {
      var content;
      content = fs.readFileSync(filename, 'utf8');
      return module._compile(content, filename);
    }
  };

  try {
    CoffeeScript = require('coffee-script');
    compilers.coffee = function(module, filename) {
      var content;
      content = CoffeeScript.compile(fs.readFileSync(filename, 'utf8'));
      return module._compile(content, filename);
    };
  } catch (err) {

  }

  try {
    eco = require('eco');
    if (eco.precompile) {
      compilers.eco = function(module, filename) {
        var content;
        content = eco.precompile(fs.readFileSync(filename, 'utf8'));
        return module._compile("module.exports = " + content, filename);
      };
    } else {
      compilers.eco = function(module, filename) {
        var content;
        content = eco.compile(fs.readFileSync(filename, 'utf8'));
        return module._compile(content, filename);
      };
    }
  } catch (err) {

  }

  exports.Package = Package = (function() {

    function Package(config) {
      this.compileSources = __bind(this.compileSources, this);
      this.compileDependencies = __bind(this.compileDependencies, this);
      var _ref2, _ref3, _ref4, _ref5;
      this.identifier = (_ref2 = config.identifier) != null ? _ref2 : 'require';
      this.paths = (_ref3 = config.paths) != null ? _ref3 : ['lib'];
      this.dependencies = (_ref4 = config.dependencies) != null ? _ref4 : [];
      this.compilers = _.extend({}, compilers, config.compilers);
      this.cache = (_ref5 = config.cache) != null ? _ref5 : true;
      this.mtimeCache = {};
      this.compileCache = {};
    }

    Package.prototype.compile = function(callback) {
      return async.parallel([this.compileDependencies, this.compileSources], function(err, parts) {
        if (err) {
          return callback(err);
        } else {
          return callback(null, parts.join("\n"));
        }
      });
    };

    Package.prototype.compileDependencies = function(callback) {
      var _this = this;
      return async.map(this.dependencies, fs.readFile, function(err, dependencySources) {
        if (err) {
          return callback(err);
        } else {
          return callback(null, dependencySources.join("\n"));
        }
      });
    };

    Package.prototype.compileSources = function(callback) {
      var _this = this;
      return async.reduce(this.paths, {}, _.bind(this.gatherSourcesFromPath, this), function(err, sources) {
        var filename, index, name, result, source, _ref2;
        if (err) return callback(err);
        result = "(function(/*! Stitch !*/) {\n  if (!this." + _this.identifier + ") {\n    var modules = {}, cache = {}, require = function(name, root) {\n      var path = expand(root, name), module = cache[path], fn;\n      if (module) {\n        return module.exports;\n      } else if (fn = modules[path] || modules[path = expand(path, './index')]) {\n        module = {id: path, exports: {}};\n        try {\n          cache[path] = module;\n          fn(module.exports, function(name) {\n            return require(name, dirname(path));\n          }, module);\n          return module.exports;\n        } catch (err) {\n          delete cache[path];\n          throw err;\n        }\n      } else {\n        throw 'module \\'' + name + '\\' not found';\n      }\n    }, expand = function(root, name) {\n      var results = [], parts, part;\n      if (/^\\.\\.?(\\/|$)/.test(name)) {\n        parts = [root, name].join('/').split('/');\n      } else {\n        parts = name.split('/');\n      }\n      for (var i = 0, length = parts.length; i < length; i++) {\n        part = parts[i];\n        if (part == '..') {\n          results.pop();\n        } else if (part != '.' && part != '') {\n          results.push(part);\n        }\n      }\n      return results.join('/');\n    }, dirname = function(path) {\n      return path.split('/').slice(0, -1).join('/');\n    };\n    this." + _this.identifier + " = function(name) {\n      return require(name, '');\n    }\n    this." + _this.identifier + ".define = function(bundle) {\n      for (var key in bundle)\n        modules[key] = bundle[key];\n    };\n  }\n  return this." + _this.identifier + ".define;\n}).call(this)({";
        index = 0;
        for (name in sources) {
          _ref2 = sources[name], filename = _ref2.filename, source = _ref2.source;
          result += index++ === 0 ? "" : ", ";
          result += JSON.stringify(name);
          result += ": function(exports, require, module) {" + source + "}";
        }
        result += "});\n";
        return callback(err, result);
      });
    };

    Package.prototype.createServer = function() {
      var _this = this;
      return function(req, res, next) {
        return _this.compile(function(err, source) {
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
      };
    };

    Package.prototype.gatherSourcesFromPath = function(sources, sourcePath, callback) {
      var _this = this;
      return fs.stat(sourcePath, function(err, stat) {
        if (err) return callback(err);
        if (stat.isDirectory()) {
          return _this.getFilesInTree(sourcePath, function(err, paths) {
            if (err) return callback(err);
            return async.reduce(paths, sources, _.bind(_this.gatherCompilableSource, _this), callback);
          });
        } else {
          return _this.gatherCompilableSource(sources, sourcePath, callback);
        }
      });
    };

    Package.prototype.gatherCompilableSource = function(sources, path, callback) {
      var _this = this;
      if (this.compilers[extname(path).slice(1)]) {
        return this.getRelativePath(path, function(err, relativePath) {
          if (err) return callback(err);
          return _this.compileFile(path, function(err, source) {
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
        });
      } else {
        return callback(null, sources);
      }
    };

    Package.prototype.getRelativePath = function(path, callback) {
      var _this = this;
      return fs.realpath(path, function(err, sourcePath) {
        if (err) return callback(err);
        return async.map(_this.paths, fs.realpath, function(err, expandedPaths) {
          var base, expandedPath, _i, _len;
          if (err) return callback(err);
          for (_i = 0, _len = expandedPaths.length; _i < _len; _i++) {
            expandedPath = expandedPaths[_i];
            base = expandedPath + "/";
            if (sourcePath.indexOf(base) === 0) {
              return callback(null, sourcePath.slice(base.length));
            }
          }
          return callback(new Error("" + path + " isn't in the require path"));
        });
      });
    };

    Package.prototype.compileFile = function(path, callback) {
      var compile, extension, mod, mtime, source;
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
        return callback(new Error("no compiler for '." + extension + "' files"));
      }
    };

    Package.prototype.walkTree = function(directory, callback) {
      var _this = this;
      return fs.readdir(directory, function(err, files) {
        if (err) return callback(err);
        return async.forEach(files, function(file, next) {
          var filename;
          if (file.match(/^\./)) return next();
          filename = join(directory, file);
          return fs.stat(filename, function(err, stats) {
            var _ref2;
            _this.mtimeCache[filename] = stats != null ? (_ref2 = stats.mtime) != null ? _ref2.toString() : void 0 : void 0;
            if (!err && stats.isDirectory()) {
              return _this.walkTree(filename, function(err, filename) {
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
          });
        }, callback);
      });
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

  })();

  exports.createPackage = function(config) {
    return new Package(config);
  };

}).call(this);
