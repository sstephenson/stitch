_      = require 'underscore'
async  = require 'async'
fs     = require 'fs'

stitch = require '.'
Module = require './module'

{extname, join, normalize} = require 'path'

module.exports = class Package
  constructor: (config = {}) ->
    @identifier   = config.identifier ? 'require'
    @paths        = config.paths ? ['lib']
    @dependencies = config.dependencies ? []
    @extensions   = _.extend {}, require.extensions, stitch.extensions, config.extensions

  compile: (callback) ->
    async.parallel [
      @compileDependencies
      @compileSources
    ], (err, parts) ->
      if err then callback err
      else callback null, parts.join("\n")

  compileDependencies: (callback) =>
    async.map @dependencies, fs.readFile, (err, dependencySources) =>
      if err then callback err
      else callback null, dependencySources.join("\n")

  compileSources: (callback) =>
    async.reduce @paths, {}, _.bind(@gatherSourcesFromPath, @), (err, sources) =>
      return callback err if err

      result = """
        (function(/*! Stitch !*/) {
          if (!this.#{@identifier}) {
            var modules = {}, cache = {}, require = function(name, root) {
              var module = cache[name], path = expand(root, name), fn;
              if (module) {
                return module;
              } else if (fn = modules[path] || modules[path = expand(path, './index')]) {
                module = {id: name, exports: {}};
                try {
                  cache[name] = module.exports;
                  fn(module.exports, function(name) {
                    return require(name, dirname(path));
                  }, module);
                  return cache[name] = module.exports;
                } catch (err) {
                  delete cache[name];
                  throw err;
                }
              } else {
                throw 'module \\'' + name + '\\' not found';
              }
            }, expand = function(root, name) {
              var results = [], parts, part;
              if (/^\\.\\.?(\\/|$)/.test(name)) {
                parts = [root, name].join('/').split('/');
              } else {
                parts = name.split('/');
              }
              for (var i = 0, length = parts.length; i < length; i++) {
                part = parts[i];
                if (part == '..') {
                  results.pop();
                } else if (part != '.' && part != '') {
                  results.push(part);
                }
              }
              return results.join('/');
            }, dirname = function(path) {
              return path.split('/').slice(0, -1).join('/');
            };
            this.#{@identifier} = function(name) {
              return require(name, '');
            }
            this.#{@identifier}.define = function(bundle) {
              for (var key in bundle)
                modules[key] = bundle[key];
            };
          }
          return this.#{@identifier}.define;
        }).call(this)({
      """

      index = 0
      for name, {filename, source} of sources
        result += if index++ is 0 then "" else ", "
        result += JSON.stringify name
        result += ": function(exports, require, module) {#{source}}"

      result += """
        });\n
      """

      callback err, result

  gatherSourcesFromPath: (sources, sourcePath, callback) ->
    fs.stat sourcePath, (err, stat) =>
      return callback err if err

      if stat.isDirectory()
        @getFilesInTree sourcePath, (err, paths) =>
          return callback err if err
          async.reduce paths, sources, _.bind(@gatherCompilableSource, @), callback
      else
        @gatherCompilableSource sources, sourcePath, callback

  gatherCompilableSource: (sources, path, callback) ->
    if @extensions[extname(path)]
      @getRelativePath path, (err, relativePath) =>
        return callback err if err

        @compileFile path, (err, source) ->
          if err then callback err
          else
            extension = extname relativePath
            key       = relativePath.slice(0, -extension.length)
            sources[key] =
              filename: relativePath
              source:   source
            callback err, sources
    else
      callback null, sources

  compileFile: (path, callback) ->
    compiler = @extensions[extname(path)]
    Module.load path, compiler, (err, mod) ->
      callback err, mod?.source

  getRelativePath: (path, callback) ->
    fs.realpath path, (err, sourcePath) =>
      return callback err if err

      async.map @paths, fs.realpath, (err, expandedPaths) ->
        return callback err if err

        for expandedPath in expandedPaths
          base = expandedPath + "/"
          if sourcePath.indexOf(base) is 0
            return callback null, sourcePath.slice base.length
        callback new Error "#{path} isn't in the require path"

  walkTree: (directory, callback) ->
    fs.readdir directory, (err, files) =>
      return callback err if err

      async.forEach files, (file, next) =>
        return next() if file.match /^\./
        filename = join directory, file

        fs.stat filename, (err, stats) =>
          if !err and stats.isDirectory()
            @walkTree filename, (err, filename) ->
              if filename
                callback err, filename
              else
                next()
          else
            callback err, filename
            next()
      , callback

  getFilesInTree: (directory, callback) ->
    files = []
    @walkTree directory, (err, filename) ->
      if err
        callback err
      else if filename
        files.push filename
      else
        callback err, files.sort()
