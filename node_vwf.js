var path = require('path'),
    http = require('http'),
    https = require('https'),
    fs = require('fs'),
    url = require('url'),
    sio = require('socket.io'),
    reflector = require('./lib/reflector'),
    argv = require('optimist').argv;


function printGeneralHelp() {
    console.log("Options:");
    console.log("  -p, --port               Port to start server on. Default: 3000");
    console.log("  -l, --log                Log level for server. Default: 1");
    console.log("  -h, --help               Output usage information");
    console.log("  -s, --ssl                Enables SSL");
    console.log("  -k, --key                Path to private key");
    console.log("  -c, --cert               Path to certificate");
}


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
function startVWF() {

    global.logLevel = ((argv.l || argv.log) ? (argv.l || argv.log) : 1);
    global.instances = {};

    function serve(request, response){

        response.writeHead( 200, {
            "Content-Type": "application/json"
        } );
        var inst = Object.keys(global.instances);
        var jsonobject = {
            "reflector": "v0.0.2"
            //"instances": inst
        }
        response.write( JSON.stringify( jsonobject ), "utf8" );
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

    //consoleNotice( 'Serving VWF support files from ' + global.vwfRoot );

    if (argv.nocache) {
        FileCache.enabled = false;
        consoleNotice('server cache disabled');
    }

    var ssl = (argv.s || argv.ssl);
    var pass = ((argv.w) ? (argv.w) : undefined);
    var sslOptions = {
        key: ((argv.k || argv.key) ? fs.readFileSync(argv.k || argv.key) : undefined),
        cert: ((argv.c || argv.cert) ? fs.readFileSync(argv.c || argv.cert) : undefined),
        ca: ( ( argv.t || argv.ca ) ? fs.readFileSync( argv.t || argv.ca ) : undefined ),
        passphrase: JSON.stringify(pass)
    };

    //create the server
    var port = ((argv.p || argv.port) ? (argv.p || argv.port) : 3002);

    var srv = ssl ? https.createServer(sslOptions, OnRequest).listen(port) : http.createServer(OnRequest).listen(port);
    consoleNotice('Serving on port ' + port);

    var socketManager = sio.listen(srv, { log: false });

    socketManager.set('transports', ['websocket']);
    socketManager.sockets.on('connection', reflector.OnConnection);
}

exports.startVWF = startVWF;
