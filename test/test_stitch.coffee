sys = require "sys"
stitch = require "stitch"

fixtureRoot  = __dirname + "/fixtures"
fixtures     = fixtureRoot + "/default"
altFixtures  = fixtureRoot + "/alternate"
fixtureCount = 7

defaultOptions =
  identifier:   "testRequire"
  sourcePaths:  [fixtures]
  requirePaths: [fixtures]

alternateOptions =
  sourcePaths:  [altFixtures]
  requirePaths: [altFixtures]

exports.testWalkTree = (test) ->
  test.expect fixtureCount

  stitch.walkTree fixtures, (err, file) ->
    if file
      test.ok file
    else
      test.done()

exports.testGetFilesInTree = (test) ->
  test.expect 2

  stitch.getFilesInTree fixtures, (err, files) ->
    test.ok !err
    test.same fixtureCount, files.length
    test.done()

exports.testGetFilesInTreeDoesNotExist = (test) ->
  test.expect 1

  stitch.getFilesInTree fixtures + "/missing", (err, files) ->
    test.ok err
    test.done()

exports.testCompileFile = (test) ->
  test.expect 2

  stitch.compileFile __filename, defaultOptions, (err, source) ->
    test.ok !err
    test.ok source.match(/\(function\(\) \{/)
    test.done()

exports.testCompileFileDoesNotExist = (test) ->
  test.expect 1

  stitch.compileFile "nosuchthing.coffee", defaultOptions, (err, source) ->
    test.ok err
    test.done()

exports.testCompileFileWithSyntaxError = (test) ->
  test.expect 1

  stitch.compileFile altFixtures + "/nonsense.coffee", alternateOptions, (err, source) ->
    test.ok err.toString().match(/SyntaxError/)
    test.done()

exports.testCompileFileWithCustomCompiler = (test) ->
  test.expect 1

  options = Object.create alternateOptions
  options.compilers =
    alert: (module, filename) ->
      source = require('fs').readFileSync filename, 'utf8'
      source = "alert(#{sys.inspect source});"
      module._compile source, filename

  stitch.compileFile altFixtures + "/hello.alert", options, (err, source) ->
    test.same "alert('hello world\\n');", source
    test.done()

exports.testCompileFileWithUnknownExtension = (test) ->
  test.expect 1

  stitch.compileFile altFixtures + "/hello.alert", alternateOptions, (err, source) ->
    test.ok err.toString().match(/no compiler/)
    test.done()

exports.testExpandPaths = (test) ->
  test.expect 3

  stitch.expandPaths [__dirname + "/../test/fixtures/default"], (err, expandedPaths) ->
    test.ok !err
    test.ok expandedPaths
    test.same [fixtures], expandedPaths
    test.done()

exports.testGetRelativePath = (test) ->
  test.expect 2

  stitch.getRelativePath [fixtures], fixtures + "/foo/bar.coffee", (err, path) ->
    test.ok !err
    test.same 'foo/bar.coffee', path
    test.done()

exports.testStripExtension = (test) ->
  test.expect 1

  filename = stitch.stripExtension "module.coffee"
  test.same "module", filename

  test.done()

exports.testGatherSources = (test) ->
  test.expect 3

  stitch.gatherSources defaultOptions, (err, sources) ->
    test.ok !err
    test.same "module.coffee", sources["module"].filename
    test.ok sources["module"].source
    test.done()

exports.testGatherSourcesCanIncludeIndividualFile = (test) ->
  test.expect 4

  options = Object.create defaultOptions
  options.sourcePaths = [fixtures + "/module.coffee"]

  stitch.gatherSources options, (err, sources) ->
    test.ok !err
    test.same 1, Object.keys(sources).length
    test.same "module.coffee", sources["module"].filename
    test.ok sources["module"].source
    test.done()

exports.testStitchGeneratesValidJavaScript = (test) ->
  test.expect 2

  stitch.stitch defaultOptions, (err, sources) ->
    test.ok !err
    eval sources
    test.ok typeof testRequire is "function"
    test.done()

exports.testStitchModuleWithCustomExports = (test) ->
  test.expect 2

  stitch.stitch defaultOptions, (err, sources) ->
    eval sources
    result = testRequire("custom_exports")
    test.ok typeof result is "function"
    test.same "foo", result()
    test.done()

exports.testStitchModuleWithExportedProperty = (test) ->
  test.expect 1

  stitch.stitch defaultOptions, (err, sources) ->
    eval sources
    test.same "bar", testRequire("exported_property").foo
    test.done()

exports.testStitchModuleWithRequires = (test) ->
  test.expect 3

  stitch.stitch defaultOptions, (err, sources) ->
    eval sources
    module = testRequire("module")
    test.same "bar", module.foo
    test.same "foo", module.bar()
    test.same "biz", module.baz
    test.done()
