fs = require 'fs'

exports.js = (module, filename) ->
  content = fs.readFileSync filename, 'utf8'
  module._compile content, filename

try
  CoffeeScript = require 'coffee-script'
  exports.coffee = (module, filename) ->
    content = CoffeeScript.compile fs.readFileSync filename, 'utf8'
    module._compile content, filename
catch err

try
  eco = require 'eco'
  exports.eco = (module, filename) ->
    content = eco.compile fs.readFileSync filename, 'utf8'
    module._compile content, filename
catch err
