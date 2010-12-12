(function() {
  var CoffeeScript, Package, async, compileCache, compileFile, compilerIsAvailableFor, defaultCompilers, expandPaths, extname, fs, getCompiledSourceFromCache, getCompilersFrom, getFilesInTree, join, mtimeCache, normalize, putCompiledSourceToCache, stripExtension, sys, walkTree, _, _ref;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __slice = Array.prototype.slice;
  _ = require('underscore');
  async = require('async');
  fs = require('fs');
  sys = require('sys');
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
  mtimeCache = {};
  exports.walkTree = walkTree = function(directory, callback) {
    return fs.readdir(directory, function(err, files) {
      if (err) {
        return callback(err);
      }
      return async.forEach(files, function(file, next) {
        var filename;
        if (file.match(/^\./)) {
          return next();
        }
        filename = join(directory, file);
        return fs.stat(filename, function(err, stats) {
          var _ref;
          mtimeCache[filename] = stats != null ? (_ref = stats.mtime) != null ? _ref.toString() : void 0 : void 0;
          if (!err && stats.isDirectory()) {
            return walkTree(filename, function(err, filename) {
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
  exports.getFilesInTree = getFilesInTree = function(directory, callback) {
    var files;
    files = [];
    return walkTree(directory, function(err, filename) {
      if (err) {
        return callback(err);
      } else if (filename) {
        return files.push(filename);
      } else {
        return callback(err, files.sort());
      }
    });
  };
  getCompilersFrom = function(options) {
    return _.extend({}, defaultCompilers, options.compilers);
  };
  compilerIsAvailableFor = function(filename, options) {
    var extension, name, _i, _len, _ref;
    _ref = Object.keys(getCompilersFrom(options));
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      name = _ref[_i];
      extension = extname(filename).slice(1);
      if (name === extension) {
        return true;
      }
    }
    return false;
  };
  compileCache = {};
  getCompiledSourceFromCache = function(path) {
    var cache;
    if (cache = compileCache[path]) {
      if (mtimeCache[path] === cache.mtime) {
        return cache.source;
      }
    }
  };
  putCompiledSourceToCache = function(path, source) {
    var mtime;
    if (mtime = mtimeCache[path]) {
      return compileCache[path] = {
        mtime: mtime,
        source: source
      };
    }
  };
  exports.compileFile = compileFile = function(path, options, callback) {
    var compile, compilers, err, extension, mod, source;
    if (options.cache && (source = getCompiledSourceFromCache(path))) {
      return callback(null, source);
    } else {
      compilers = getCompilersFrom(options);
      extension = extname(path).slice(1);
      if (compile = compilers[extension]) {
        source = null;
        mod = {
          _compile: function(content, filename) {
            return source = content;
          }
        };
        try {
          compile(mod, path);
          if (options.cache) {
            putCompiledSourceToCache(path, source);
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
    }
  };
  expandPaths = function(sourcePaths, callback) {
    return async.map(sourcePaths, fs.realpath, callback);
  };
  stripExtension = function(filename) {
    var extension;
    extension = extname(filename);
    return filename.slice(0, -extension.length);
  };
  exports.Package = Package = function() {
    function Package(config) {
      var _ref, _ref2;
      this.identifier = (_ref = config.identifier) != null ? _ref : 'require';
      this.paths = (_ref2 = config.paths) != null ? _ref2 : ['lib'];
    }
    Package.prototype.compile = function(callback) {
      return this.gatherSources(__bind(function(err, sources) {
        var filename, index, name, result, source, _ref;
        if (err) {
          return callback(err);
        } else {
          result = "var " + this.identifier + " = (function(modules) {\n  var exportCache = {};\n  return function require(name) {\n    var module = exportCache[name];\n    var fn;\n    if (module) {\n      return module;\n    } else if (fn = modules[name]) {\n      module = { id: name, exports: {} };\n      fn(module.exports, require, module);\n      exportCache[name] = module.exports;\n      return module.exports;\n    } else {\n      throw 'module \\'' + name + '\\' not found';\n    }\n  }\n})({";
          index = 0;
          for (name in sources) {
            _ref = sources[name], filename = _ref.filename, source = _ref.source;
            result += index++ === 0 ? "" : ", ";
            result += sys.inspect(name);
            result += ": function(exports, require, module) {" + source + "}";
          }
          result += "});\n";
          return callback(null, result);
        }
      }, this));
    };
    Package.prototype.gatherSources = function(callback) {
      return async.map(this.paths, this.gatherSourcesFromPath.bind(this), function(err, results) {
        if (err) {
          return callback(err);
        }
        return callback(null, _.extend.apply(_, [{}].concat(__slice.call(results))));
      });
    };
    Package.prototype.gatherSourcesFromPath = function(sourcePath, callback) {
      var options;
      options = {
        paths: this.paths
      };
      return fs.stat(sourcePath, __bind(function(err, stat) {
        if (err) {
          return callback(err);
        }
        if (stat.isDirectory()) {
          return getFilesInTree(sourcePath, __bind(function(err, paths) {
            if (err) {
              return callback(err);
            } else {
              return async.reduce(paths, {}, __bind(function(sources, path, next) {
                if (compilerIsAvailableFor(path, options)) {
                  return this.gatherSource(path, function(err, key, value) {
                    sources[key] = value;
                    return next(err, sources);
                  });
                } else {
                  return next(null, sources);
                }
              }, this), callback);
            }
          }, this));
        } else {
          return this.gatherSource(sourcePath, function(err, key, value) {
            var sources;
            if (err) {
              return callback(err);
            } else {
              sources = {};
              sources[key] = value;
              return callback(null, sources);
            }
          });
        }
      }, this));
    };
    Package.prototype.gatherSource = function(path, callback) {
      var options;
      options = {
        paths: this.paths
      };
      return this.getRelativePath(path, function(err, relativePath) {
        if (err) {
          return callback(err);
        } else {
          return compileFile(path, options, function(err, source) {
            if (err) {
              return callback(err);
            } else {
              return callback(err, stripExtension(relativePath), {
                filename: relativePath,
                source: source
              });
            }
          });
        }
      });
    };
    Package.prototype.getRelativePath = function(path, callback) {
      path = normalize(path);
      return expandPaths(this.paths, function(err, expandedPaths) {
        if (err) {
          return callback(err);
        }
        return fs.realpath(path, function(err, path) {
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
      });
    };
    return Package;
  }();
  exports.createPackage = function(config) {
    return new Package(config);
  };
}).call(this);
