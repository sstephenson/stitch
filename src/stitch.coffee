_     = require 'underscore'
async = require 'async'
fs    = require 'fs'

{extname, join, normalize} = require 'path'

exports.compilers = compilers =
  js: (module, filename) ->
    content = fs.readFileSync filename, 'utf8'
    module._compile content, filename

try
  CoffeeScript = require 'coffee-script'
  compilers.coffee = (module, filename) ->
    content = CoffeeScript.compile fs.readFileSync filename, 'utf8'
    module._compile content, filename
catch err

try
  eco = require 'eco'
  if eco.precompile
    compilers.eco = (module, filename) ->
      content = eco.precompile fs.readFileSync filename, 'utf8'
      module._compile "module.exports = #{content}", filename
  else
    compilers.eco = (module, filename) ->
      content = eco.compile fs.readFileSync filename, 'utf8'
      module._compile content, filename
catch err


exports.Package = class Package
  constructor: (config) ->
    @identifier   = config.identifier ? 'require'
    @paths        = config.paths ? ['lib']
    @dependencies = config.dependencies ? []
    @compilers    = _.extend {}, compilers, config.compilers

    @cache        = config.cache ? true
    @mtimeCache   = {}
    @compileCache = {}

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
              var path = expand(root, name), module = cache[path], fn;
              if (module) {
                return module.exports;
              } else if (fn = modules[path] || modules[path = expand(path, './index')]) {
                module = {id: path, exports: {}};
                try {
                  cache[path] = module;
                  fn(module.exports, function(name) {
                    return require(name, dirname(path));
                  }, module);
                  return module.exports;
                } catch (err) {
                  delete cache[path];
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

  createServer: ->
    (req, res, next) =>
      @compile (err, source) ->
        if err
          console.error "#{err.stack}"
          message = "" + err.stack
          res.writeHead 500, 'Content-Type': 'text/javascript'
          res.end "throw #{JSON.stringify(message)}"
        else
          res.writeHead 200, 'Content-Type': 'text/javascript'
          res.end source


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
    if @compilers[extname(path).slice(1)]
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

  compileFile: (path, callback) ->
    extension = extname(path).slice(1)

    if @cache and @compileCache[path] and @mtimeCache[path] is @compileCache[path].mtime
      callback null, @compileCache[path].source
    else if compile = @compilers[extension]
      source = null
      mod =
        _compile: (content, filename) ->
          source = content

      try
        compile mod, path

        if @cache and mtime = @mtimeCache[path]
          @compileCache[path] = {mtime, source}

        callback null, source
      catch err
        if err instanceof Error
          err.message = "can't compile #{path}\n#{err.message}"
        else
          err = new Error "can't compile #{path}\n#{err}"
        callback err
    else
      callback new Error "no compiler for '.#{extension}' files"

  walkTree: (directory, callback) ->
    fs.readdir directory, (err, files) =>
      return callback err if err

      async.forEach files, (file, next) =>
        return next() if file.match /^\./
        filename = join directory, file

        fs.stat filename, (err, stats) =>
          @mtimeCache[filename] = stats?.mtime?.toString()

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


exports.createPackage = (config) ->
  new Package config
