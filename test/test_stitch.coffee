sys = require "sys"
stitch= require "stitch"

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

module.exports =
  "walk tree": (test) ->
    test.expect fixtureCount

    stitch.walkTree fixtures, (err, file) ->
      if file
        test.ok file
      else
        test.done()

  "get files in tree": (test) ->
    test.expect 2

    stitch.getFilesInTree fixtures, (err, files) ->
      test.ok !err
      test.same fixtureCount, files.length
      test.done()

  "get files in tree that does not exist": (test) ->
    test.expect 1

    stitch.getFilesInTree fixtures + "/missing", (err, files) ->
      test.ok err
      test.done()

  "compile file": (test) ->
    test.expect 2

    stitch.compileFile __filename, defaultOptions, (err, source) ->
      test.ok !err
      test.ok source.match(/\(function\(\) \{/)
      test.done()

  "compile file does not exist": (test) ->
    test.expect 1

    stitch.compileFile "nosuchthing.coffee", defaultOptions, (err, source) ->
      test.ok err
      test.done()

  "compile file with syntax error": (test) ->
    test.expect 1

    stitch.compileFile altFixtures + "/nonsense.coffee", alternateOptions, (err, source) ->
      test.ok err.toString().match(/SyntaxError/)
      test.done()

  "compile file with custom compiler": (test) ->
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

  "compile file with unknown extension": (test) ->
    test.expect 1

    stitch.compileFile altFixtures + "/hello.alert", alternateOptions, (err, source) ->
      test.ok err.toString().match(/no compiler/)
      test.done()

  "expand paths": (test) ->
    test.expect 3

    stitch.expandPaths [__dirname + "/../test/fixtures/default"], (err, expandedPaths) ->
      test.ok !err
      test.ok expandedPaths
      test.same [fixtures], expandedPaths
      test.done()

  "get relative path": (test) ->
    test.expect 2

    stitch.getRelativePath [fixtures], fixtures + "/foo/bar.coffee", (err, path) ->
      test.ok !err
      test.same 'foo/bar.coffee', path
      test.done()

  "strip extension": (test) ->
    test.expect 1

    filename = stitch.stripExtension "module.coffee"
    test.same "module", filename

    test.done()

  "gather sources": (test) ->
    test.expect 3

    stitch.gatherSources defaultOptions, (err, sources) ->
      test.ok !err
      test.same "module.coffee", sources["module"].filename
      test.ok sources["module"].source
      test.done()

  "gather sources can include invividual file": (test) ->
    test.expect 4

    options = Object.create defaultOptions
    options.sourcePaths = [fixtures + "/module.coffee"]

    stitch.gatherSources options, (err, sources) ->
      test.ok !err
      test.same 1, Object.keys(sources).length
      test.same "module.coffee", sources["module"].filename
      test.ok sources["module"].source
      test.done()

  "compile generates valid javascript": (test) ->
    test.expect 2

    stitch.compile defaultOptions, (err, sources) ->
      test.ok !err
      eval sources
      test.ok typeof testRequire is "function"
      test.done()

  "compile module with custom exports": (test) ->
    test.expect 2

    stitch.compile defaultOptions, (err, sources) ->
      eval sources
      result = testRequire("custom_exports")
      test.ok typeof result is "function"
      test.same "foo", result()
      test.done()

  "compile module with exported property": (test) ->
    test.expect 1

    stitch.compile defaultOptions, (err, sources) ->
      eval sources
      test.same "bar", testRequire("exported_property").foo
      test.done()

  "compile module with requires": (test) ->
    test.expect 3

    stitch.compile defaultOptions, (err, sources) ->
      eval sources
      module = testRequire("module")
      test.same "bar", module.foo
      test.same "foo", module.bar()
      test.same "biz", module.baz
      test.done()

  "runtime require only loads files once": (test) ->
    test.expect 2

    stitch.compile defaultOptions, (err, sources) ->
      eval sources

      module = testRequire("module")
      test.ok !module.x
      module.x = "foo"
      test.same "foo", testRequire("module").x

      test.done()
