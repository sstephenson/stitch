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
    compilers.eco = function(module, filename) {
      var content;
      content = eco.compile(fs.readFileSync(filename, 'utf8'));
      return module._compile(content, filename);
    };
  } catch (err) {

  }
  exports.Package = Package = (function() {
    function Package(config) {
      var _ref, _ref2, _ref3;
      this.identifier = (_ref = config.identifier) != null ? _ref : 'require';
      this.paths = (_ref2 = config.paths) != null ? _ref2 : ['lib'];
      this.compilers = _.extend({}, compilers, config.compilers);
      this.cache = (_ref3 = config.cache) != null ? _ref3 : true;
      this.mtimeCache = {};
      this.compileCache = {};
    }
    Package.prototype.compile = function(callback) {
      return this.gatherSources(__bind(function(err, sources) {
        var filename, index, name, result, source, _ref;
        if (err) {
          return callback(err);
        }
        result = "(function(/*! Stitch !*/) {\n  if (!this." + this.identifier + ") {\n    var modules = {}, cache = {}, require = function(name, root) {\n      var module = cache[name], path = expand(root, name), fn;\n      if (module) {\n        return module;\n      } else if (fn = modules[path] || modules[path = expand(path, './index')]) {\n        module = {id: name, exports: {}};\n        try {\n          cache[name] = module.exports;\n          fn(module.exports, function(name) {\n            return require(name, dirname(path));\n          }, module);\n          return cache[name] = module.exports;\n        } catch (err) {\n          delete cache[name];\n          throw err;\n        }\n      } else {\n        throw 'module \\'' + name + '\\' not found';\n      }\n    }, expand = function(root, name) {\n      var results = [], parts, part;\n      if (/^\\.\\.?(\\/|$)/.test(name)) {\n        parts = [root, name].join('/').split('/');\n      } else {\n        parts = name.split('/');\n      }\n      for (var i = 0, length = parts.length; i < length; i++) {\n        part = parts[i];\n        if (part == '..') {\n          results.pop();\n        } else if (part != '.' && part != '') {\n          results.push(part);\n        }\n      }\n      return results.join('/');\n    }, dirname = function(path) {\n      return path.split('/').slice(0, -1).join('/');\n    };\n    this." + this.identifier + " = function(name) {\n      return require(name, '');\n    }\n    this." + this.identifier + ".define = function(bundle) {\n      for (var key in bundle)\n        modules[key] = bundle[key];\n    };\n  }\n  return this." + this.identifier + ".define;\n}).call(this)({";
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
    Package.prototype.findRequires = function(callback) {
      return this.gatherSources(__bind(function(err, sources) {
        var path, requires, source;
        requires = [];
        if (!err) {
          for (path in sources) {
            source = sources[path].source;
            requires.push.apply(requires, this.findRequiresInSource(source));
          }
        }
        return callback(err, _.uniq(requires));
      }, this));
    };
    Package.prototype.findRequiresInSource = function(source) {
      var ast, isStringConcatenation, parser, requires, stringFrom, uglify, walker, _ref;
      _ref = require('uglify-js'), parser = _ref.parser, uglify = _ref.uglify;
      requires = [];
      ast = parser.parse(source);
      walker = uglify.ast_walker();
      isStringConcatenation = function(expr) {
        var left, right;
        if (expr[0] === 'binary' && expr[1] === '+') {
          left = expr[2];
          right = expr[3];
          if (isStringConcatenation(left)) {
            return true;
          } else if (left[0] === 'string') {
            return true;
          } else if (right[0] === 'string') {
            if (left[0] === 'dot') {
              return true;
            } else if (left[0] === 'call') {
              return true;
            }
          }
        }
      };
      stringFrom = function(expr) {
        if (expr[0] === 'binary' && expr[1] === '+') {
          return stringFrom(expr[2]) + stringFrom(expr[3]);
        } else if (expr[0] === 'string') {
          return expr[1];
        } else {
          return '*';
        }
      };
      walker.with_walkers({
        'call': function(expr, args) {
          if (expr[0] === 'name' && expr[1] === 'require' && args.length === 1) {
            if (args[0][0] === 'string') {
              return requires.push(args[0][1]);
            } else if (isStringConcatenation(args[0])) {
              return requires.push(stringFrom(args[0]));
            }
          }
        }
      }, function() {
        return walker.walk(ast);
      });
      return requires;
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
    Package.prototype.gatherSources = function(callback) {
      return async.reduce(this.paths, {}, _.bind(this.gatherSourcesFromPath, this), callback);
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
            return async.reduce(paths, sources, _.bind(this.gatherCompilableSource, this), callback);
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
  })();
  exports.createPackage = function(config) {
    return new Package(config);
  };
}).call(this);
