(function() {
  var Module, cache, extname, fs, _;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  _ = require('underscore');
  fs = require('fs');
  extname = require('path').extname;
  cache = {
    entries: {},
    getEntry: function(path, compiler) {
      var _ref;
      return _.detect((_ref = this.entries[path]) != null ? _ref : [], function(entry) {
        return entry.compiler === compiler;
      });
    },
    get: function(path, compiler) {
      var _ref;
      return (_ref = this.getEntry(path, compiler)) != null ? _ref.module : void 0;
    },
    put: function(path, compiler, module) {
      var entry, _base, _ref;
      if (entry = this.getEntry(path, compiler)) {
        return entry.module = module;
      } else {
        (_ref = (_base = this.entries)[path]) != null ? _ref : _base[path] = [];
        return this.entries[path].push({
          module: module,
          compiler: compiler
        });
      }
    }
  };
  module.exports = Module = (function() {
    Module.load = function(path, compiler, callback) {
      return fs.stat(path, __bind(function(err, stat) {
        var mod, mtime, source;
        if (err) {
          return callback(err);
        }
        mtime = stat.mtime.getTime();
        mod = cache.get(path, compiler);
        if (mod && mod.mtime === mtime) {
          return callback(null, mod);
        } else {
          try {
            source = this.compile(path, compiler);
            mod = new Module(path, mtime, source);
            cache.put(path, compiler, mod);
            return callback(null, mod);
          } catch (err) {
            return callback(err);
          }
        }
      }, this));
    };
    Module.compile = function(path, compiler) {
      var err, extension, mod, source;
      extension = extname(path);
      if (compiler) {
        source = null;
        mod = {
          _compile: function(content, filename) {
            return source = content;
          }
        };
        try {
          compiler(mod, path);
          return source;
        } catch (err) {
          if (err instanceof Error) {
            err.message = "can't compile " + path + "\n" + err.message;
          } else {
            err = new Error("can't compile " + path + "\n" + err);
          }
          throw err;
        }
      } else {
        throw new Error("no compiler for '." + extension + "' files");
      }
    };
    function Module(path, mtime, source) {
      this.path = path;
      this.mtime = mtime;
      this.source = source;
    }
    return Module;
  })();
}).call(this);
