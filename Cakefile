require.paths.push __dirname + '/lib'
fs = require 'fs'

task 'build', 'Build lib/ from src/', ->
  CoffeeScript = require 'coffee-script'
  source = fs.readFileSync __dirname + '/src/stitch.coffee'
  output = CoffeeScript.compile source.toString()
  fs.writeFileSync __dirname + '/lib/stitch.js', output

task 'test', 'Run tests', ->
  invoke 'build'
  process.chdir __dirname
  {reporters} = require 'nodeunit'
  reporters.default.run ['test']
