_         = require 'underscore'
fs        = require 'fs'
{extname} = require 'path'

cache =
  entries: {}

  getEntry: (path, compiler) ->
    _.detect @entries[path] ? [], (entry) ->
      entry.compiler is compiler

  get: (path, compiler) ->
    @getEntry(path, compiler)?.module

  put: (path, compiler, module) ->
    if entry = @getEntry path, compiler
      entry.module = module
    else
      @entries[path] ?= []
      @entries[path].push {module, compiler}

module.exports = class Module
  @load: (path, compiler, callback) ->
    fs.stat path, (err, stat) =>
      return callback err if err

      mtime = stat.mtime.getTime()
      mod = cache.get path, compiler

      if mod and mod.mtime is mtime
        callback null, mod
      else
        try
          source = @compile path, compiler
          mod = new Module path, mtime, source
          cache.put path, compiler, mod
          callback null, mod
        catch err
          callback err

  @compile: (path, compiler) ->
    extension = extname(path)

    if compiler
      source = null
      mod =
        _compile: (content, filename) ->
          source = content
      try
        compiler mod, path
        source

      catch err
        if err instanceof Error
          err.message = "can't compile #{path}\n#{err.message}"
        else
          err = new Error "can't compile #{path}\n#{err}"
        throw err
    else
      throw new Error "no compiler for '.#{extension}' files"

  constructor: (@path, @mtime, @source) ->
