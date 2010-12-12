require.paths.unshift __dirname + '/lib'

{print} = require 'sys'
{spawn} = require 'child_process'

task 'build', 'Build lib/ from src/', ->
  coffee = spawn 'coffee', ['-c', '-o', 'lib', 'src']
  coffee.stdout.on 'data', (data) -> print data.toString()

task 'test', 'Run tests', ->
  invoke 'build'
  process.chdir __dirname
  {reporters} = require 'nodeunit'
  reporters.default.run ['test']
