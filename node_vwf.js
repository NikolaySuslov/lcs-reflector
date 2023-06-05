/*
The MIT License (MIT)
Copyright (c) 2014-2018 Nikolai Suslov and the Krestianstvo.org project contributors. (https://github.com/NikolaySuslov/lcs-reflector/blob/master/LICENSE.md)

Virtual World Framework Apache 2.0 license  (https://github.com/NikolaySuslov/lcs-reflector/blob/master/licenses/LICENSE_VWF.md)
*/

var http = require('http'),
    https = require('https'),
    argv = require('yargs').argv,
    wslib = require('ws'),
    //sio = require('socket.io'),
    config = require('./server/readConfig')


// Basic logging function.
global.log = function () {
    var args = Array.prototype.slice.call(arguments);
    var level = args.splice(args.length - 1)[0];

    if (!isNaN(parseInt(level))) {
        level = parseInt(level);
    } else {
        args.push(level)
        level = 1;
    };

    if (level <= global.logLevel) {
        console.log.apply(this, args);
    }
};

function consoleNotice(string) {
    var brown = '\u001b[33m';
    var reset = '\u001b[0m';
    global.log(brown + string + reset);
}

function consoleError(string) {
    var red = '\u001b[31m';
    var reset = '\u001b[0m';
    global.log(red + string + reset);
}



//Start the VWF server
function startVWF(reflector) {

    config.readConfigFile();

    global.logLevel = ((argv.l || argv.log) ? (argv.l || argv.log) : 1);
    global.instances = {};

    function serve(request, response) {

        response.writeHead(200, {
            "Content-Type": "application/json"
        });
        var inst = Object.keys(global.instances);
        var jsonobject = {
            "reflector": "v0.8.0"
            //"instances": inst
        }
        response.write(JSON.stringify(jsonobject), "utf8");
        response.end();
        //console.log("Serve here")

    }

    function OnRequest(request, response) {
        try {
            serve(request, response);
            // vwf.Serve( request, response );

        } catch (e) {
            response.writeHead(500, {
                "Content-Type": "text/plain"
            });
            response.write(e.toString(), "utf8");
            response.end();
        }
    } // close onRequest

    consoleNotice('LogLevel = ' + global.logLevel);

    //create the server

    var conf = config.parseConfigOptions();

    var server = conf.ssl ? https.createServer(conf.sslOptions, OnRequest): http.createServer(OnRequest);
    consoleNotice('Serving on port ' + conf.port);

    const wss = new wslib.WebSocketServer({server});
    wss.on('connection', reflector.OnConnection);

    server.listen(conf.port) 
}

exports.startVWF = startVWF;
