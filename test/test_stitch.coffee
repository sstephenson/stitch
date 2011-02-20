sys = require "sys"
fs  = require "fs"
stitch = require "stitch"

fixtureRoot  = __dirname + "/fixtures"
fixtures     = fixtureRoot + "/default"
altFixtures  = fixtureRoot + "/alternate"
addlFixtures = fixtureRoot + "/additional"
fixtureCount = 11

defaultOptions =
  identifier: "testRequire"
  paths:      [fixtures]

defaultPackage = stitch.createPackage defaultOptions

additionalOptions =
  identifier: "testRequire"
  paths:      [addlFixtures]

additionalPackage = stitch.createPackage additionalOptions

alternateOptions =
  paths:      [altFixtures]

alternatePackage = stitch.createPackage alternateOptions

module.exports =
  "walk tree": (test) ->
    test.expect fixtureCount

    defaultPackage.walkTree fixtures, (err, file) ->
      if file
        test.ok file
      else
        test.done()

  "get files in tree": (test) ->
    test.expect 2

    defaultPackage.getFilesInTree fixtures, (err, files) ->
      test.ok !err
      test.same fixtureCount, files.length
      test.done()

  "get files in tree that does not exist": (test) ->
    test.expect 1

    defaultPackage.getFilesInTree fixtures + "/missing", (err, files) ->
      test.ok err
      test.done()

  "get files in empty directory": (test) ->
    test.expect 1

    dirname = fixtures + "/empty"
    fs.mkdirSync dirname, 0755
    defaultPackage.getFilesInTree dirname, (err, files) ->
      test.ok !err
      fs.rmdirSync dirname
      test.done()

  "compile file": (test) ->
    test.expect 2

    defaultPackage.compileFile __filename, (err, source) ->
      test.ok !err
      test.ok source.match(/\(function\(\) \{/)
      test.done()

  "compile file does not exist": (test) ->
    test.expect 1

    defaultPackage.compileFile "nosuchthing.coffee", (err, source) ->
      test.ok err
      test.done()

  "compile file with syntax error": (test) ->
    test.expect 1

    alternatePackage.compileFile altFixtures + "/nonsense.coffee", (err, source) ->
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
    package = stitch.createPackage options

    package.compileFile altFixtures + "/hello.alert", (err, source) ->
      test.same "alert('hello world\\n');", source
      test.done()

  "compile file with unknown extension": (test) ->
    test.expect 1

    alternatePackage.compileFile altFixtures + "/hello.alert", (err, source) ->
      test.ok err.toString().match(/no compiler/)
      test.done()

  "get relative path": (test) ->
    test.expect 2

    defaultPackage.getRelativePath fixtures + "/foo/bar.coffee", (err, path) ->
      test.ok !err
      test.same 'foo/bar.coffee', path
      test.done()

  "compile generates valid javascript": (test) ->
    test.expect 2

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources
      test.ok typeof @testRequire is "function"
      test.done()

  "compile module with custom exports": (test) ->
    test.expect 3

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources
      result = @testRequire("custom_exports")
      test.ok typeof result is "function"
      test.same "foo", result()
      test.done()

  "compile module with exported property": (test) ->
    test.expect 2

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources
      test.same "bar", @testRequire("exported_property").foo
      test.done()

  "compile module with requires": (test) ->
    test.expect 4

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources
      module = @testRequire("module")
      test.same "bar", module.foo
      test.same "foo", module.bar()
      test.same "biz", module.baz
      test.done()

  "runtime require only loads files once": (test) ->
    test.expect 3

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources
      module = @testRequire("module")
      test.ok !module.x
      module.x = "foo"
      test.same "foo", @testRequire("module").x
      test.done()

  "look for module index if necessary": (test) ->
    test.expect 2

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources
      buz = @testRequire("foo/buz").buz
      test.same buz, "BUZ"
      test.done()

  "modules can be defined at runtime": (test) ->
    test.expect 3

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources

      raised = false
      try
        @testRequire("frob")
      catch e
        raised = true
      test.ok raised

      @testRequire.define
        "frob": (exports, require, module) ->
          exports.frob = require("foo/buz").buz

      test.same "BUZ", @testRequire("frob").frob
      test.done()

  "multiple packages may share the same require namespace": (test) ->
    test.expect 5

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources

      additionalPackage.compile (err, sources) =>
        test.ok !err
        eval sources

        test.same "hello", @testRequire("hello").hello
        test.same "additional/foo/bar.js", @testRequire("foo/bar").filename
        test.same "biz", @testRequire("foo/bar/baz").baz;
        test.done()

  "relative require": (test) ->
    test.expect 6

    defaultPackage.compile (err, sources) ->
      test.ok !err
      eval sources

      relative = @testRequire("relative")
      test.same "a", relative.a.a
      test.same "b", relative.a.b
      test.same "foo", relative.custom()
      test.same "biz", relative.baz
      test.same "BUZ", relative.buz
      test.done()
