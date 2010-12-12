_       = require 'underscore'
async   = require 'async'
connect = require 'connect'
fs      = require 'fs'

{extname, join, normalize} = require 'path'

defaultCompilers =
  js: (module, filename) ->
    content = fs.readFileSync filename, 'utf8'
    module._compile content, filename

try
  CoffeeScript = require 'coffee-script'
  defaultCompilers.coffee = (module, filename) ->
    content = CoffeeScript.compile fs.readFileSync filename, 'utf8'
    module._compile content, filename
catch err


exports.Package = class Package
  constructor: (config) ->
    @identifier = config.identifier or 'require'
    @paths      = config.paths or ['lib']
    @compilers  = _.extend {}, defaultCompilers, config.compilers

    @cache        = config.cache or true
    @mtimeCache   = {}
    @compileCache = {}

  compile: (callback) ->
    async.reduce @paths, {}, @gatherSourcesFromPath.bind(@), (err, sources) =>
      return callback err if err

      result = """
        var #{@identifier} = (function(modules) {
          var exportCache = {};
          return function require(name) {
            var module = exportCache[name];
            var fn;
            if (module) {
              return module;
            } else if (fn = modules[name]) {
              module = { id: name, exports: {} };
              fn(module.exports, require, module);
              exportCache[name] = module.exports;
              return module.exports;
            } else {
              throw 'module \\'' + name + '\\' not found';
            }
          }
        })({
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
    connect.createServer (req, res, next) =>
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
          async.reduce paths, sources, @gatherCompilableSource.bind(@), callback
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
    path = normalize path

    async.map @paths, fs.realpath, (err, expandedPaths) ->
      return callback err if err

      for expandedPath in expandedPaths
        base = expandedPath + "/"
        if path.indexOf(base) is 0
          return callback null, path.slice base.length
      callback "#{path} isn't in the require path"

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
      callback "no compiler for '.#{extension}' files"

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
