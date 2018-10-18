/*
The MIT License (MIT)
Copyright (c) 2014-2018 Nikolai Suslov and the Krestianstvo.org project contributors. (https://github.com/NikolaySuslov/lcs-reflector/blob/master/LICENSE.md)
*/

var reflector = require('./lib/reflector')
module.exports = reflector

if (!module.parent) {
    var server = require('./node_vwf');
    server.startVWF(reflector);
}