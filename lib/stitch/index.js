(function() {
  var CoffeeScript, Package, compileCache, compileFile, compilerIsAvailableFor, defaultCompilers, expandPaths, extend, extname, forEachAsync, fs, getCompiledSourceFromCache, getCompilersFrom, getFilesInTree, join, merge, mtimeCache, normalize, putCompiledSourceToCache, stripExtension, sys, walkTree, _ref;
  var __slice = Array.prototype.slice, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
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
  extend = function(destination, source) {
    var key, value;
    for (key in source) {
      value = source[key];
      destination[key] = value;
    }
    return destination;
  };
  merge = function() {
    var object, objects, result, _i, _len;
    objects = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    result = {};
    for (_i = 0, _len = objects.length; _i < _len; _i++) {
      object = objects[_i];
      if (object) {
        extend(result, object);
      }
    }
    return result;
  };
  forEachAsync = function(elements, callback) {
    var element, next, remainingCount, _i, _len, _results;
    remainingCount = elements.length;
    if (remainingCount === 0) {
      return callback(null, null);
    }
    next = function() {
      remainingCount--;
      if (remainingCount <= 0) {
        return callback(null, null);
      }
    };
    _results = [];
    for (_i = 0, _len = elements.length; _i < _len; _i++) {
      element = elements[_i];
      _results.push(callback(next, element));
    }
    return _results;
  };
  mtimeCache = {};
  exports.walkTree = walkTree = function(directory, callback) {
    return fs.readdir(directory, function(err, files) {
      if (err) {
        return callback(err);
      }
      return forEachAsync(files, function(next, file) {
        var filename;
        if (next) {
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
        } else {
          return callback(err, null);
        }
      });
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
    return merge(defaultCompilers, options.compilers);
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
    var paths;
    paths = [];
    return forEachAsync(sourcePaths, function(next, sourcePath) {
      if (next) {
        return fs.realpath(sourcePath, function(err, path) {
          if (err) {
            callback(err);
          } else {
            paths.push(normalize(path));
          }
          return next();
        });
      } else {
        return callback(null, paths);
      }
    });
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
      var sources;
      sources = {};
      return forEachAsync(this.paths, __bind(function(next, sourcePath) {
        if (next) {
          return this.gatherSourcesFromPath(sourcePath, function(err, pathSources) {
            var key, value;
            if (err) {
              callback(err);
            } else {
              for (key in pathSources) {
                value = pathSources[key];
                sources[key] = value;
              }
            }
            return next();
          });
        } else {
          return callback(null, sources);
        }
      }, this));
    };
    Package.prototype.gatherSourcesFromPath = function(sourcePath, callback) {
      var options;
      options = {
        paths: this.paths
      };
      return fs.stat(sourcePath, __bind(function(err, stat) {
        var sources;
        if (err) {
          return callback(err);
        }
        sources = {};
        if (stat.isDirectory()) {
          return getFilesInTree(sourcePath, __bind(function(err, paths) {
            if (err) {
              return callback(err);
            } else {
              return forEachAsync(paths, __bind(function(next, path) {
                if (next) {
                  if (compilerIsAvailableFor(path, options)) {
                    return this.gatherSource(path, function(err, key, value) {
                      if (err) {
                        callback(err);
                      } else {
                        sources[key] = value;
                      }
                      return next();
                    });
                  } else {
                    return next();
                  }
                } else {
                  return callback(null, sources);
                }
              }, this));
            }
          }, this));
        } else {
          return this.gatherSource(sourcePath, function(err, key, value) {
            if (err) {
              callback(err);
            } else {
              sources[key] = value;
            }
            return callback(null, sources);
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
