<img src="https://github.com/downloads/sstephenson/stitch/logo.jpg"
width=432 height=329>

Develop and test your JavaScript applications as CommonJS modules in
Node.js. Then __Stitch__ them together to run in the browser.

    var stitch  = require('stitch');
    var express = require('express');

    var package = stitch.createPackage({
      paths: [__dirname + '/lib', __dirname + '/vendor']
    });

    var app = express.createServer();
    app.get('/application.js', package.createServer());
