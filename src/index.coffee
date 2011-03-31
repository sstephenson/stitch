try
  require 'coffee-script'
  require 'eco'
catch err

exports.Package = Package = require './package'

exports.createPackage = createPackage = (config) ->
  new Package config

exports.extensions = {}

exports.compile = (config, callback) ->
  createPackage(config).compile callback

exports.compiler = (config) ->
  (req, res, next) ->
    compile config, (err, source) ->
      if err
        message = "#{err.stack}"
        res.writeHead 500, "Content-Type": "text/javascript"
        res.end "throw #{JSON.stringify(message)}"
      else
        res.writeHead 200, "Content-Type": "text/javascript"
        res.end source
