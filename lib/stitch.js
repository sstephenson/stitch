(function() {
  var _a, compileFile, compilerIsAvailableFor, defaultCompilers, expandPaths, extend, extname, forEachAsync, fs, gatherSource, gatherSources, gatherSourcesFromPath, getCompilersFrom, getFilesInTree, getRelativePath, join, merge, normalize, stripExtension, sys, walkTree;
  var __hasProp = Object.prototype.hasOwnProperty, __slice = Array.prototype.slice;
  fs = require('fs');
  sys = require('sys');
  _a = require('path');
  extname = _a.extname;
  join = _a.join;
  normalize = _a.normalize;
  defaultCompilers = {
    js: function(source) {
      return source;
    }
  };
  try {
    defaultCompilers.coffee = require('coffee-script').compile;
  } catch (err) {

  }
  extend = function(destination, source) {
    var _b, key, value;
    _b = source;
    for (key in _b) {
      if (!__hasProp.call(_b, key)) continue;
      value = _b[key];
      destination[key] = value;
    }
    return destination;
  };
  merge = function() {
    var _b, _c, _d, object, objects, result;
    objects = __slice.call(arguments, 0);
    result = {};
    _c = objects;
    for (_b = 0, _d = _c.length; _b < _d; _b++) {
      object = _c[_b];
      if (object) {
        extend(result, object);
      }
    }
    return result;
  };
  forEachAsync = function(elements, callback) {
    var _b, _c, _d, _e, element, next, remainingCount;
    remainingCount = elements.length;
    next = function() {
      remainingCount--;
      return remainingCount <= 0 ? callback(false, null) : null;
    };
    _b = []; _d = elements;
    for (_c = 0, _e = _d.length; _c < _e; _c++) {
      element = _d[_c];
      _b.push(callback(next, element));
    }
    return _b;
  };
  exports.walkTree = (walkTree = function(directory, callback) {
    return fs.readdir(directory, function(err, files) {
      if (err) {
        return callback(err);
      }
      return forEachAsync(files, function(next, file) {
        var filename;
        if (next) {
          filename = join(directory, file);
          return fs.stat(filename, function(err, stats) {
            if (stats.isDirectory()) {
              return walkTree(filename, function(err, filename) {
                return filename ? callback(err, filename) : next();
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
  });
  exports.getFilesInTree = (getFilesInTree = function(directory, callback) {
    var files;
    files = [];
    return walkTree(directory, function(err, filename) {
      if (err) {
        return callback(err);
      } else if (filename) {
        return files.push(filename);
      } else {
        return callback(err, files);
      }
    });
  });
  getCompilersFrom = function(options) {
    return merge(defaultCompilers, options.compilers);
  };
  compilerIsAvailableFor = function(filename, options) {
    var _b, _c, _d, extension, name;
    _c = Object.keys(getCompilersFrom(options));
    for (_b = 0, _d = _c.length; _b < _d; _b++) {
      name = _c[_b];
      extension = extname(filename).slice(1);
      if (name === extension) {
        return true;
      }
    }
    return false;
  };
  exports.compileFile = (compileFile = function(path, options, callback) {
    var compilers, extension;
    compilers = getCompilersFrom(options);
    extension = extname(path).slice(1);
    return fs.readFile(path, function(err, contents) {
      var compile, source;
      if (err) {
        return callback(err);
      } else {
        source = contents.toString();
        if (compile = compilers[extension]) {
          try {
            return callback(false, compile(source));
          } catch (err) {
            return callback(err);
          }
        } else {
          return callback("no compiler for '." + (extension) + "' files");
        }
      }
    });
  });
  exports.expandPaths = (expandPaths = function(sourcePaths, callback) {
    var paths;
    paths = [];
    return forEachAsync(sourcePaths, function(next, sourcePath) {
      return next ? fs.realpath(sourcePath, function(err, path) {
        if (err) {
          callback(err);
        } else {
          paths.push(normalize(path));
        }
        return next();
      }) : callback(null, paths);
    });
  });
  exports.getRelativePath = (getRelativePath = function(requirePaths, path, callback) {
    path = normalize(path);
    return expandPaths(requirePaths, function(err, expandedPaths) {
      if (err) {
        return callback(err);
      }
      return fs.realpath(path, function(err, path) {
        var _b, _c, _d, base, expandedPath;
        if (err) {
          return callback(err);
        }
        _c = expandedPaths;
        for (_b = 0, _d = _c.length; _b < _d; _b++) {
          expandedPath = _c[_b];
          base = expandedPath + "/";
          if (path.indexOf(base) === 0) {
            return callback(false, path.slice(base.length));
          }
        }
        return callback("" + (path) + " isn't in the require path");
      });
    });
  });
  exports.stripExtension = (stripExtension = function(filename) {
    var extension;
    extension = extname(filename);
    return filename.slice(0, -extension.length);
  });
  gatherSource = function(path, options, callback) {
    return getRelativePath(options.requirePaths, path, function(err, relativePath) {
      return err ? callback(err) : compileFile(path, options, function(err, source) {
        return err ? callback(err) : callback(err, stripExtension(relativePath), {
          filename: relativePath,
          source: source
        });
      });
    });
  };
  gatherSourcesFromPath = function(sourcePath, options, callback) {
    return fs.stat(sourcePath, function(err, stat) {
      var sources;
      if (err) {
        return callback(err);
      }
      sources = {};
      return stat.isDirectory() ? getFilesInTree(sourcePath, function(err, paths) {
        return err ? callback(err) : forEachAsync(paths, function(next, path) {
          return next ? (compilerIsAvailableFor(path, options) ? gatherSource(path, options, function(err, key, value) {
            if (err) {
              callback(err);
            } else {
              sources[key] = value;
            }
            return next();
          }) : next()) : callback(null, sources);
        });
      }) : gatherSource(sourcePath, options, function(err, key, value) {
        if (err) {
          callback(err);
        } else {
          sources[key] = value;
        }
        return callback(false, sources);
      });
    });
  };
  exports.gatherSources = (gatherSources = function(options, callback) {
    var _b, sourcePaths, sources;
    _b = options;
    sourcePaths = _b.sourcePaths;
    sources = {};
    return forEachAsync(sourcePaths, function(next, sourcePath) {
      return next ? gatherSourcesFromPath(sourcePath, options, function(err, pathSources) {
        var _c, key, value;
        if (err) {
          callback(err);
        } else {
          _c = pathSources;
          for (key in _c) {
            if (!__hasProp.call(_c, key)) continue;
            value = _c[key];
            sources[key] = value;
          }
        }
        return next();
      }) : callback(null, sources);
    });
  });
  exports.stitch = function(options, callback) {
    options.identifier = (typeof options.identifier !== "undefined" && options.identifier !== null) ? options.identifier : 'require';
    options.sourcePaths = (typeof options.sourcePaths !== "undefined" && options.sourcePaths !== null) ? options.sourcePaths : ['lib'];
    options.requirePaths = (typeof options.requirePaths !== "undefined" && options.requirePaths !== null) ? options.requirePaths : ['lib'];
    return gatherSources(options, function(err, sources) {
      var _b, _c, filename, index, name, result, source;
      if (err) {
        return callback(err);
      } else {
        result = ("var " + (options.identifier) + " = (function(modules) {\n  return function require(name) {\n    var fn = modules[name], module;\n    if (fn) {\n      module = { id: name, exports: {} };\n      fn(module.exports, require, module);\n      return module.exports;\n    } else {\n      throw 'module \\'' + name + '\\' not found';\n    }\n  }\n})({");
        index = 0;
        _b = sources;
        for (name in _b) {
          if (!__hasProp.call(_b, name)) continue;
          _c = _b[name];
          filename = _c.filename;
          source = _c.source;
          result += (index++ === 0 ? "" : ", ");
          result += sys.inspect(name);
          result += (": function(exports, require, module) {" + (source) + "}");
        }
        result += "});\n";
        return callback(false, result);
      }
    });
  };
})();
