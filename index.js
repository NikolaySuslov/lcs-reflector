// Copyright (c) 2018 Nikolai Suslov
// Krestianstvo.org MIT license (https://github.com/NikolaySuslov/lcs-reflector/blob/master/LICENSE.md)

var reflector = require('./lib/reflector')
module.exports = reflector

if (!module.parent) {
    var server = require('./node_vwf');
    server.startVWF(reflector);
}