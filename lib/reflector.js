/*
The MIT License (MIT)
Copyright (c) 2014-2023 Nikolai Suslov and the Krestianstvo.org project contributors. (https://github.com/NikolaySuslov/lcs-reflector/blob/master/LICENSE.md)

Virtual World Framework Apache 2.0 license  (https://github.com/NikolaySuslov/lcs-reflector/blob/master/licenses/LICENSE_VWF.md)
*/

"use strict";

// JoinPath
// Takes multiple arguments, joins them together into one path.
function JoinPath( /* arguments */) {
    var result = "";
    if (arguments.length > 0) {
        if (arguments[0]) {
            result = arguments[0];
        }
        for (var index = 1; index < arguments.length; index++) {
            var newSegment = arguments[index];
            if (newSegment == undefined) {
                newSegment = "";
            }

            if ((newSegment[0] == "/") && (result[result.length - 1] == "/")) {
                result = result + newSegment.slice(1);
            } else if ((newSegment[0] == "/") || (result[result.length - 1] == "/")) {
                result = result + newSegment;
            } else {
                result = result + "/" + newSegment;
            }
            //result = libpath.join( result, newSegment );
        }
    }
    return result;
}

function parseSocketUrl(socket, req) {

    try {
        var query = require('url')
            .parse(req.url)
            .query;
        var referer = require('querystring')
            .parse(query)
            .pathname;

        let moniker = require('querystring')
            .parse(query)
            .moniker;

        var resObj = require('querystring')
            .parse(query)
            .path;

        var namespace = referer;
        if (!namespace) return null;
        if (namespace[namespace.length - 1] != "/")
            namespace += "/";

        let parsedPath = JSON.parse(resObj);


        if (parsedPath) {
            parsedPath.moniker = moniker
            return parsedPath
        }
        // else {
        //     return parseurl.Process(namespace);
        // } 

    }
    catch (e) {
        return null;
    }
}

//Get the instance ID from the handshake headers for a socket
function GetNamespace(processedURL) {
    if ((processedURL['instance']) && (processedURL['public_path'])) {
        return JoinPath(processedURL['public_path'], processedURL['application'], processedURL['instance']);
    }
    return undefined;
}

function GetNow() {
    //return new Date( ).getTime( ) / 1000.0;
    let hrt = process.hrtime();
    return (hrt[0] * 1e9 + hrt[1]) / 1e9
}

function OnConnection(socket, req) {

    let resObj = parseSocketUrl(socket, req);

    if (resObj == null) {

        setInterval(function () {

            var address = req.headers.host;
            var obj = {};
            for (var prop in global.instances) {
                let user = global.instances[prop].user;
                let loadInfo = global.instances[prop].loadInfo;
                obj[prop] = {
                    "instance": address + '/' + user + prop,
                    "clients": Object.keys(global.instances[prop].clients).length,
                    "user": user,
                    "loadInfo": loadInfo
                };
            }
            var json = JSON.stringify(obj);
            socket.send('getWebAppUpdate', json);
        }, 3000);

        //          socket.on('getWebAppUpdate', function(msg){

        //   });

        return
    }

    let processedURL = resObj.path;
    //get instance for new connection
    var namespace = GetNamespace(processedURL);
    if (namespace == undefined) {
        return;
    }

    //prepare for persistence request in case that's what this is

    var loadInfo = resObj.loadInfo //GetLoadForSocket( processedURL );
    var saveObject = resObj.saveObject //persistence.LoadSaveObject( loadInfo );
    var user = resObj.user;



    //if it's a new instance, setup record 
    if (!global.instances[namespace]) {
        global.instances[namespace] = {};
        global.instances[namespace].loadInfo = loadInfo;
        global.instances[namespace].user = user;
        global.instances[namespace].clients = {};
        global.instances[namespace].pendingList = [];
        global.instances[namespace].start_time = undefined;
        global.instances[namespace].pause_time = undefined;
        global.instances[namespace].rate = 1.0;
        global.instances[namespace].setTime = function (time) {
            this.start_time = GetNow() - time;
            this.pause_time = undefined;
            this.rate = 1.0;
        };
        global.instances[namespace].isPlaying = function () {
            if ((this.start_time != undefined) && (this.pause_time == undefined)) {
                return true;
            }
            return false
        };
        global.instances[namespace].isPaused = function () {
            if ((this.start_time != undefined) && (this.pause_time != undefined)) {
                return true;
            }
            return false
        };
        global.instances[namespace].isStopped = function () {
            if (this.start_time == undefined) {
                return true;
            }
            return false;
        };
        global.instances[namespace].getTime = function () {
            if (this.isPlaying()) {
                return (GetNow() - this.start_time) * this.rate;
            } else if (this.isPaused()) {
                return (this.pause_time - this.start_time) * this.rate;
            }
            else {
                return 0.0;
            }
        };
        global.instances[namespace].play = function () {
            if (this.isStopped()) {
                this.start_time = GetNow();
                this.pause_time = undefined;
            } else if (this.isPaused()) {
                this.start_time = this.start_time + (GetNow() - this.pause_time);
                this.pause_time = undefined;
            }
        };
        global.instances[namespace].pause = function () {
            if (this.isPlaying()) {
                this.pause_time = GetNow();
            }
        };
        global.instances[namespace].stop = function () {
            if ((this.isPlaying()) || (this.isPaused())) {
                this.start_time = undefined;
                this.pause_time = undefined;
            }
        };
        global.instances[namespace].setTime(0.0);

        if (saveObject) {
            if (saveObject["queue"]) {
                if (saveObject["queue"]["time"]) {
                    global.instances[namespace].setTime(saveObject["queue"]["time"]);
                }
            }
        }


        global.instances[namespace].state = {};

        var log;
        function generateLogFile() {
            try {
                if (!fs.existsSync('.//log/')) {
                    fs.mkdir('.//log/', function (err) {
                        if (err) {
                            console.log(err);
                        }
                    })
                }
                log = fs.createWriteStream('.//log/' + namespace.replace(/[\\\/]/g, '_'), { 'flags': 'a' });
            } catch (err) {
                console.log('Error generating Node Server Log File\n');
            }
        }

        global.instances[namespace].Log = function (message, level) {
            if (global.logLevel >= level) {
                if (!log) {
                    generateLogFile();
                }
                log.write(message + '\n');
                global.log(message + '\n');
            }
        };

        global.instances[namespace].Error = function (message, level) {
            var red, brown, reset;
            red = '\u001b[31m';
            brown = '\u001b[33m';
            reset = '\u001b[0m';
            if (global.logLevel >= level) {
                if (!log) {
                    generateLogFile();
                }
                log.write(message + '\n');
                global.log(red + message + reset + '\n');
            }
        };


        //keep track of the timer for this instance
        global.instances[namespace].timerID = setInterval(function () {
            var message = { parameters: [], time: global.instances[namespace].getTime() };
            for (var i in global.instances[namespace].clients) {
                var client = global.instances[namespace].clients[i];
                if (!client.pending) {
                    client.send(JSON.stringify(message));
                }
            }
            if (global.instances[namespace]) {
                if (global.instances[namespace].pendingList.pending) {
                    global.instances[namespace].pendingList.push(message);
                }
            }
        }, 50);

    }

    //add the new client to the instance data
    socket.id = resObj.moniker//req.headers["sec-websocket-key"]
    global.instances[namespace].clients[socket.id] = socket;

    socket.pending = true;

    // The time for the setState message should be the time the new client joins, so save that time
    var setStateTime = global.instances[namespace].getTime();

    // If this client is the first, it can just load the application, and mark it not pending
    if (Object.keys(global.instances[namespace].clients).length === 1) {

        if (saveObject) {
            socket.send(JSON.stringify({
                action: "setState",
                parameters: [saveObject],
                time: global.instances[namespace].getTime()
            }));
        }
        else {
            var instance = namespace;
            //Get the state and load it.
            //Now the server has a rough idea of what the simulation is

            socket.send(JSON.stringify({
                action: "createNode",
                parameters: ["proxy/clients.vwf"],
                time: global.instances[namespace].getTime()
            }));

            socket.send(JSON.stringify({
                action: "createNode",
                parameters: [
                    (processedURL.public_path === "/" ? "" : processedURL.public_path) + "/" + processedURL.application,
                    "application"
                ],
                time: global.instances[namespace].getTime()
            }));
        }

        socket.pending = false;

    }
    else {  //this client is not the first, we need to get the state and mark it pending
        if (!global.instances[namespace].pendingList.pending) {
            var firstclient = Object.keys(global.instances[namespace].clients)[0];
            firstclient = global.instances[namespace].clients[firstclient];
            firstclient.send(JSON.stringify({
                action: "getState",
                respond: true,
                time: global.instances[namespace].getTime()
            }));
            global.instances[namespace].Log('GetState from Client', 2);
            global.instances[namespace].pendingList.pending = true;
        }
        socket.pending = true;

    }

    //Create a child in the application's 'clients.vwf' global to represent this client.
    var clientNodeMessage = {
        action: "createChild",
        parameters: ["proxy/clients.vwf", socket.id],
        time: global.instances[namespace].getTime()
    };

    // Send messages to all the existing clients (that are not pending),
    // telling them to create a new node under the "clients" parent for the new client
    for (var i in global.instances[namespace].clients) {
        var client = global.instances[namespace].clients[i];
        if (!client.pending) {
            client.send(JSON.stringify(clientNodeMessage));
        }
    }
    if (global.instances[namespace].pendingList.pending) {
        global.instances[namespace].pendingList.push(clientNodeMessage);
    }


    socket.on('message', function (msg) {

        //need to add the client identifier to all outgoing messages
        try {
            var message = JSON.parse(msg);
        }
        catch (e) {
            console.error("Error on socket message: ", e);
            return;
        }

        message.client = socket.id;
        message.time = global.instances[namespace].getTime(); //message.time ? message.time : global.instances[ namespace ].getTime( );

        if (message.result === undefined) {

            //distribute message to all clients on given instance
            for (var i in global.instances[namespace].clients) {
                var client = global.instances[namespace].clients[i];

                //just a regular message, so push if the client is pending a load, otherwise just send it.
                if (!client.pending) {
                    client.send(JSON.stringify(message));
                }
            }

            if (global.instances[namespace]) {
                if (global.instances[namespace].pendingList.pending) {
                    global.instances[namespace].pendingList.push(message);
                }
            }

        } else if (message.action == "getState") {

            //distribute message to all clients on given instance
            for (var i in global.instances[namespace].clients) {
                var client = global.instances[namespace].clients[i];

                //if the message was get state, then fire all the pending messages after firing the setState
                if (client.pending) {
                    global.instances[namespace].Log('Got State', 2);
                    var state = message.result;
                    global.instances[namespace].Log(state, 2);
                    client.send(JSON.stringify({ action: "setState", parameters: [state], time: setStateTime }));
                    client.pending = false;
                    for (var j = 0; j < global.instances[namespace].pendingList.length; j++) {
                        client.send(JSON.stringify(global.instances[namespace].pendingList[j]));
                    }
                }
            }

            global.instances[namespace].pendingList = [];

        }

    });

    // When a client disconnects, go ahead and remove the instance data
    socket.on('close', function () {

        // Remove the disconnecting client
        global.instances[namespace].clients[socket.id] = null;
        delete global.instances[namespace].clients[socket.id];

        // Notify others of the disconnecting client.  Delete the child representing this client in the application's `clients.vwf` global.
        var clientMessage = { action: "deleteChild", parameters: ["proxy/clients.vwf", socket.id], time: global.instances[namespace].getTime() };
        for (var i in global.instances[namespace].clients) {
            var client = global.instances[namespace].clients[i];
            if (!client.pending) {
                client.send(JSON.stringify(clientMessage));
            }
        }

        if (global.instances[namespace]) {

            if (global.instances[namespace].pendingList.pending) {
                global.instances[namespace].pendingList.push(clientMessage);
            }

            // If it's the last client, delete the data and the timer
            if (Object.keys(global.instances[namespace].clients).length == 0) {
                clearInterval(global.instances[namespace].timerID);
                delete global.instances[namespace];
            }
        }

    });
}

function GetInstances() {
    return global.instances;
}

exports.OnConnection = OnConnection;
exports.GetInstances = GetInstances;