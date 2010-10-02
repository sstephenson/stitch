fs = require 'fs'
sys = require 'sys'
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

extend = (destination, source) ->
  for key, value of source
    destination[key] = value
  destination

merge = (objects...) ->
  result = {}
  for object in objects
    extend result, object if object
  result

forEachAsync = (elements, callback) ->
  remainingCount = elements.length

  next = () ->
    remainingCount--
    if remainingCount <= 0
      callback null, null

  for element in elements
    callback next, element

module.exports = stitch = (options, callback) ->
  options.identifier   ?= 'require'
  options.sourcePaths  ?= ['lib']
  options.requirePaths ?= ['lib']

  gatherSources options, (err, sources) ->
    if err
      callback err
    else
      result = """
        var #{options.identifier} = (function(modules) {
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
        result += sys.inspect name
        result += ": function(exports, require, module) {#{source}}"

      result += """
        });\n
      """

      callback null, result

stitch.walkTree = walkTree = (directory, callback) ->
  fs.readdir directory, (err, files) ->
    if err then return callback err

    forEachAsync files, (next, file) ->
      if next
        return next() if file.match /^\./
        filename = join directory, file

        fs.stat filename, (err, stats) ->
          if !err and stats.isDirectory()
            walkTree filename, (err, filename) ->
              if filename
                callback err, filename
              else
                next()
          else
            callback err, filename
            next()
      else
        callback err, null

stitch.getFilesInTree = getFilesInTree = (directory, callback) ->
  files = []
  walkTree directory, (err, filename) ->
    if err
      callback err
    else if filename
      files.push filename
    else
      callback err, files

getCompilersFrom = (options) ->
  merge defaultCompilers, options.compilers

compilerIsAvailableFor = (filename, options) ->
  for name in Object.keys getCompilersFrom options
    extension = extname(filename).slice(1)
    return true if name is extension
  false

stitch.compileFile = compileFile = (path, options, callback) ->
  compilers = getCompilersFrom options
  extension = extname(path).slice(1)

  if compile = compilers[extension]
    source = null
    mod =
      _compile: (content, filename) ->
        source = content

    try
      compile mod, path
      callback null, source
    catch err
      callback err
  else
    callback "no compiler for '.#{extension}' files"

stitch.expandPaths = expandPaths = (sourcePaths, callback) ->
  paths = []

  forEachAsync sourcePaths, (next, sourcePath) ->
    if next
      fs.realpath sourcePath, (err, path) ->
        if err
          callback err
        else
          paths.push normalize path
        next()
    else
      callback null, paths

stitch.getRelativePath = getRelativePath = (requirePaths, path, callback) ->
  path = normalize path

  expandPaths requirePaths, (err, expandedPaths) ->
    return callback err if err

    fs.realpath path, (err, path) ->
      return callback err if err

      for expandedPath in expandedPaths
        base = expandedPath + "/"
        if path.indexOf(base) is 0
          return callback null, path.slice base.length

      callback "#{path} isn't in the require path"

stitch.stripExtension = stripExtension = (filename) ->
  extension = extname filename
  filename.slice 0, -extension.length

gatherSource = (path, options, callback) ->
  getRelativePath options.requirePaths, path, (err, relativePath) ->
    if err then callback err
    else
      compileFile path, options, (err, source) ->
        if err then callback err
        else
          callback err, stripExtension(relativePath),
            filename: relativePath
            source:   source

gatherSourcesFromPath = (sourcePath, options, callback) ->
  fs.stat sourcePath, (err, stat) ->
    if err then return callback err

    sources = {}

    if stat.isDirectory()
      getFilesInTree sourcePath, (err, paths) ->
        if err then callback err
        else
          forEachAsync paths, (next, path) ->
            if next
              if compilerIsAvailableFor path, options
                gatherSource path, options, (err, key, value) ->
                  if err then callback err
                  else sources[key] = value
                  next()
              else
                next()
            else
              callback null, sources
    else
      gatherSource sourcePath, options, (err, key, value) ->
        if err then callback err
        else sources[key] = value
        callback null, sources

stitch.gatherSources = gatherSources = (options, callback) ->
  {sourcePaths} = options
  sources = {}

  forEachAsync sourcePaths, (next, sourcePath) ->
    if next
      gatherSourcesFromPath sourcePath, options, (err, pathSources) ->
        if err then callback err
        else
          for key, value of pathSources
            sources[key] = value
        next()
    else
      callback null, sources
