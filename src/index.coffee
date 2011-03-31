exports.compilers = require './compilers'

exports.Package = Package = require './package'

exports.createPackage = (config) ->
  new Package config
