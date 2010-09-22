(function() {
  var CoffeeScript, _ref, compileFile, compilerIsAvailableFor, defaultCompilers, expandPaths, extend, extname, forEachAsync, fs, gatherSource, gatherSources, gatherSourcesFromPath, getCompilersFrom, getFilesInTree, getRelativePath, join, merge, normalize, stripExtension, sys, walkTree;
  var __hasProp = Object.prototype.hasOwnProperty, __slice = Array.prototype.slice;
  fs = require('fs');
  sys = require('sys');
  _ref = require('path');
  extname = _ref.extname;
  join = _ref.join;
  normalize = _ref.normalize;
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
      module.filename = ("" + (filename) + " (compiled)");
      return module._compile(content, module.filename);
    };
  } catch (err) {

  }
  extend = function(destination, source) {
    var _ref2, key, value;
    _ref2 = source;
    for (key in _ref2) {
      if (!__hasProp.call(_ref2, key)) continue;
      value = _ref2[key];
      destination[key] = value;
    }
    return destination;
  };
  merge = function() {
    var _i, _len, _ref2, object, objects, result;
    objects = __slice.call(arguments, 0);
    result = {};
    _ref2 = objects;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      object = _ref2[_i];
      if (object) {
        extend(result, object);
      }
    }
    return result;
  };
  forEachAsync = function(elements, callback) {
    var _i, _len, _ref2, _result, element, next, remainingCount;
    remainingCount = elements.length;
    next = function() {
      remainingCount--;
      return remainingCount <= 0 ? callback(null, null) : null;
    };
    _result = []; _ref2 = elements;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      element = _ref2[_i];
      _result.push(callback(next, element));
    }
    return _result;
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
    var _i, _len, _ref2, extension, name;
    _ref2 = Object.keys(getCompilersFrom(options));
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      name = _ref2[_i];
      extension = extname(filename).slice(1);
      if (name === extension) {
        return true;
      }
    }
    return false;
  };
  exports.compileFile = (compileFile = function(path, options, callback) {
    var compile, compilers, extension, mod, source;
    compilers = getCompilersFrom(options);
    extension = extname(path).slice(1);
    if (compile = compilers[extension]) {
      source = null;
      mod = {
        _compile: function(content, filename) {
          return (source = content);
        }
      };
      try {
        compile(mod, path);
        return callback(null, source);
      } catch (err) {
        return callback(err);
      }
    } else {
      return callback("no compiler for '." + (extension) + "' files");
    }
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
        var _i, _len, _ref2, base, expandedPath;
        if (err) {
          return callback(err);
        }
        _ref2 = expandedPaths;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          expandedPath = _ref2[_i];
          base = expandedPath + "/";
          if (path.indexOf(base) === 0) {
            return callback(null, path.slice(base.length));
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
        return callback(null, sources);
      });
    });
  };
  exports.gatherSources = (gatherSources = function(options, callback) {
    var _ref2, sourcePaths, sources;
    _ref2 = options;
    sourcePaths = _ref2.sourcePaths;
    sources = {};
    return forEachAsync(sourcePaths, function(next, sourcePath) {
      return next ? gatherSourcesFromPath(sourcePath, options, function(err, pathSources) {
        var _ref3, key, value;
        if (err) {
          callback(err);
        } else {
          _ref3 = pathSources;
          for (key in _ref3) {
            if (!__hasProp.call(_ref3, key)) continue;
            value = _ref3[key];
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
      var _ref2, _ref3, filename, index, name, result, source;
      if (err) {
        return callback(err);
      } else {
        result = ("var " + (options.identifier) + " = (function(modules) {\n  return function require(name) {\n    var fn = modules[name], module;\n    if (fn) {\n      module = { id: name, exports: {} };\n      fn(module.exports, require, module);\n      return module.exports;\n    } else {\n      throw 'module \\'' + name + '\\' not found';\n    }\n  }\n})({");
        index = 0;
        _ref2 = sources;
        for (name in _ref2) {
          if (!__hasProp.call(_ref2, name)) continue;
          _ref3 = _ref2[name];
          filename = _ref3.filename;
          source = _ref3.source;
          result += (index++ === 0 ? "" : ", ");
          result += sys.inspect(name);
          result += (": function(exports, require, module) {" + (source) + "}");
        }
        result += "});\n";
        return callback(null, result);
      }
    });
  };
}).call(this);
