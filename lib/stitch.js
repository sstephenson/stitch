(function() {
  var CoffeeScript, compileCache, compileFile, compilerIsAvailableFor, defaultCompilers, expandPaths, extend, extname, forEachAsync, fs, gatherSource, gatherSources, gatherSourcesFromPath, getCompiledSourceFromCache, getCompilersFrom, getFilesInTree, getRelativePath, join, merge, mtimeCache, normalize, putCompiledSourceToCache, stitch, stripExtension, sys, walkTree, _ref;
  var __slice = Array.prototype.slice;
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
  module.exports = stitch = function(options, callback) {
    var _ref, _ref2, _ref3;
    (_ref = options.identifier) != null ? _ref : options.identifier = 'require';
    (_ref2 = options.sourcePaths) != null ? _ref2 : options.sourcePaths = ['lib'];
    (_ref3 = options.requirePaths) != null ? _ref3 : options.requirePaths = ['lib'];
    return gatherSources(options, function(err, sources) {
      var filename, index, name, result, source, _ref;
      if (err) {
        return callback(err);
      } else {
        result = "var " + options.identifier + " = (function(modules) {\n  var exportCache = {};\n  return function require(name) {\n    var module = exportCache[name];\n    var fn;\n    if (module) {\n      return module;\n    } else if (fn = modules[name]) {\n      module = { id: name, exports: {} };\n      fn(module.exports, require, module);\n      exportCache[name] = module.exports;\n      return module.exports;\n    } else {\n      throw 'module \\'' + name + '\\' not found';\n    }\n  }\n})({";
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
    });
  };
  mtimeCache = {};
  stitch.walkTree = walkTree = function(directory, callback) {
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
  stitch.getFilesInTree = getFilesInTree = function(directory, callback) {
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
  stitch.compileFile = compileFile = function(path, options, callback) {
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
  stitch.expandPaths = expandPaths = function(sourcePaths, callback) {
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
  stitch.getRelativePath = getRelativePath = function(requirePaths, path, callback) {
    path = normalize(path);
    return expandPaths(requirePaths, function(err, expandedPaths) {
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
  stitch.stripExtension = stripExtension = function(filename) {
    var extension;
    extension = extname(filename);
    return filename.slice(0, -extension.length);
  };
  gatherSource = function(path, options, callback) {
    return getRelativePath(options.requirePaths, path, function(err, relativePath) {
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
  gatherSourcesFromPath = function(sourcePath, options, callback) {
    return fs.stat(sourcePath, function(err, stat) {
      var sources;
      if (err) {
        return callback(err);
      }
      sources = {};
      if (stat.isDirectory()) {
        return getFilesInTree(sourcePath, function(err, paths) {
          if (err) {
            return callback(err);
          } else {
            return forEachAsync(paths, function(next, path) {
              if (next) {
                if (compilerIsAvailableFor(path, options)) {
                  return gatherSource(path, options, function(err, key, value) {
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
            });
          }
        });
      } else {
        return gatherSource(sourcePath, options, function(err, key, value) {
          if (err) {
            callback(err);
          } else {
            sources[key] = value;
          }
          return callback(null, sources);
        });
      }
    });
  };
  stitch.gatherSources = gatherSources = function(options, callback) {
    var sourcePaths, sources;
    sourcePaths = options.sourcePaths;
    sources = {};
    return forEachAsync(sourcePaths, function(next, sourcePath) {
      if (next) {
        return gatherSourcesFromPath(sourcePath, options, function(err, pathSources) {
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
    });
  };
}).call(this);
