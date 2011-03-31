<img src="https://github.com/downloads/sstephenson/stitch/logo.jpg"
width=432 height=329>

Develop and test your JavaScript applications as CommonJS modules in
Node.js. Then __Stitch__ them together to run in the browser.

    npm install stitch

Bundle code in lib/ and vendor/ and serve it with [Express](http://expressjs.com/):

    var stitch  = require('stitch');
    var express = require('express');

    var package = stitch.createPackage({
      paths: [__dirname + '/lib', __dirname + '/vendor']
    });

    var app = express.createServer();
    app.get('/application.js', package.createServer());
    app.listen(3000);

Or build it to a file:

    var stitch  = require('stitch');
    var fs      = require('fs');

    var package = stitch.createPackage({
      paths: [__dirname + '/lib', __dirname + '/vendor']
    });

    package.compile(function (err, source){
      fs.writeFile('package.js', source, function (err) {
        if (err) throw err;
        console.log('Compiled package.js');
      })
    })
