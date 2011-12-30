sys = require "util"
fs  = require "fs"
stitch = require "../."

fixtureRoot  = __dirname + "/fixtures"
fixtures     = fixtureRoot + "/default"
altFixtures  = fixtureRoot + "/alternate"
addlFixtures = fixtureRoot + "/additional"
ecoFixtures  = fixtureRoot + "/eco"
linkFixtures = fixtureRoot + "/link"
fixtureCount = 17

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

ecoOptions =
  identifier: "testRequire"
  paths:      [ecoFixtures]
ecoPackage = stitch.createPackage ecoOptions

dependencyOptions =
  identifier:   "testRequire"
  paths:        [fixtures]
  dependencies: [
    fixtureRoot + "/dependencies/zepto.js"
    fixtureRoot + "/dependencies/underscore.js"
    fixtureRoot + "/dependencies/backbone.js"
  ]
dependencyPackage = stitch.createPackage dependencyOptions

linkOptions =
  identifier: "testRequire"
  paths:      [linkFixtures]
linkPackage = stitch.createPackage linkOptions


load = (source, callback) ->
  (-> eval source).call module = {}
  callback? (source) -> (-> eval source).call module
  module.testRequire

rescue = (callback) ->
  rescued = false
  try
    callback()
  catch err
    rescued = true
  rescued


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
      testRequire = load sources
      test.ok typeof testRequire is "function"
      test.done()

  "compile module with custom exports": (test) ->
    test.expect 3

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources
      result = testRequire("custom_exports")
      test.ok typeof result is "function"
      test.same "foo", result()
      test.done()

  "compile module with exported property": (test) ->
    test.expect 2

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources
      test.same "bar", testRequire("exported_property").foo
      test.done()

  "compile module with requires": (test) ->
    test.expect 4

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources
      module = testRequire("module")
      test.same "bar", module.foo
      test.same "foo", module.bar()
      test.same "biz", module.baz
      test.done()

  "runtime require only loads files once": (test) ->
    test.expect 3

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources
      module = testRequire("module")
      test.ok !module.x
      module.x = "foo"
      test.same "foo", testRequire("module").x
      test.done()

  "look for module index if necessary": (test) ->
    test.expect 2

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources
      buz = testRequire("foo/buz").buz
      test.same buz, "BUZ"
      test.done()

  "modules can be defined at runtime": (test) ->
    test.expect 3

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources

      test.ok rescue -> testRequire("frob")

      testRequire.define
        "frob": (exports, require, module) ->
          exports.frob = require("foo/buz").buz

      test.same "BUZ", testRequire("frob").frob
      test.done()

  "multiple packages may share the same require namespace": (test) ->
    test.expect 5

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources, (load) ->
        additionalPackage.compile (err, sources) ->
          test.ok !err
          load sources

          test.same "hello", testRequire("hello").hello
          test.same "additional/foo/bar.js", testRequire("foo/bar").filename
          test.same "biz", testRequire("foo/bar/baz").baz;
          test.done()

  "relative require": (test) ->
    test.expect 6

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources

      relative = testRequire("relative")
      test.same "a", relative.a.a
      test.same "b", relative.a.b
      test.same "foo", relative.custom()
      test.same "biz", relative.baz
      test.same "BUZ", relative.buz
      test.done()

  "circular require": (test) ->
    test.expect 7

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources

      circular = testRequire("circular")
      test.same "a", circular.using_exports_a.a()
      test.same "a", circular.using_exports_b.b()
      test.same "a", circular.using_exports_a.b()

      test.same "a", circular.using_module_exports_a.a()
      test.same "a", circular.using_module_exports_b.b()
      test.same "a", circular.using_module_exports_a.b()

      test.done()

  "errors at require time don't leave behind a partially loaded cache": (test) ->
    test.expect 3

    defaultPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources

      test.ok rescue -> testRequire("circular/error")
      test.ok rescue -> testRequire("circular/error")
      test.done()

  "dependencies option concatenates files in order": (test) ->
    test.expect 5
    dependencyPackage.compile (err, sources) ->
      test.ok !err
      lines = sources.split("\n").slice(0, 5)

      test.same "// Zepto", lines[0]
      test.same "// Underscore", lines[2]
      test.same "// Backbone", lines[4]

      testRequire = load sources
      test.ok testRequire("foo/bar/baz")
      test.done()

  "paths may be symlinks": (test) ->
    test.expect 2
    linkPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources
      test.ok testRequire("foo/bar/baz")
      test.done()

if stitch.compilers.eco
  module.exports["eco compiler"] = (test) ->
    test.expect 2
    ecoPackage.compile (err, sources) ->
      test.ok !err
      testRequire = load sources

      html = testRequire("hello.html")(name: "Sam").trim()
      test.same "hello Sam!", html.split("\n").pop()
      test.done()

