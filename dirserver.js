var IP = '127.0.0.1';
var HTTPPORT = 8080;
var TCPPORT = 1337;
var PRESENTPORT = 8081;
var SOCKETIOPORT = 8082;

var getNetworkIP = (function () {
    var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

    var exec = require('child_process').exec;
    var cached;    
    var command;
    var filterRE;

    switch (process.platform) {
    // TODO: implement for OSs without ifconfig command
    case 'darwin':
         command = 'ifconfig';
         filterRE = /\binet\s+([^\s]+)/g;
         // filterRE = /\binet6\s+([^\s]+)/g; // IPv6
         break;
    default:
         command = 'ifconfig';
         filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
         // filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
         break;
    }

    return function (callback, bypassCache) {
         // get cached value
        if (cached && !bypassCache) {
            callback(null, cached);
            return;
        }
        // system call
        exec(command, function (error, stdout, sterr) {
            var ips = [];
            // extract IPs
            var matches = stdout.match(filterRE);
            // JS has no lookbehind REs, so we need a trick
            for (var i = 0; i < matches.length; i++) {
                ips.push(matches[i].replace(filterRE, '$1'));
            }

            // filter BS
            for (var i = 0, l = ips.length; i < l; i++) {
                if (!ignoreRE.test(ips[i])) {
                    //if (!error) {
                        cached = ips[i];
                    //}
                    callback(error, ips[i]);
                    return;
                }
            }
            // nothing found
            callback(error, null);
        });
    };
})();

getNetworkIP(function (error, ip0) {
  IP = ip0;
  console.log('OAK DIRECTRORY NODE v0.1');
console.log('- Kasper Rasmussen');
console.log();
consolelog('Kører på oak://' + IP + ':' + TCPPORT);
consolelog('Kører på http://' + IP + ':' + HTTPPORT);
console.log();
console.log('[LOG]');
    if (error) {
        console.log('error:', error);
    }
}, false);

var sockets = require('./tcp.js').server(TCPPORT);
var http = require('http');
var fs   = require('fs');

var io = require('socket.io').listen(SOCKETIOPORT);
io.set('log level', 1)
var log = [];


var iosocket = undefined;
io.sockets.on('connection', function (socket0) {
  socket0.emit('previous', { log: log });
  iosocket = socket0;
  updateRouters();
});

function consolelog(text) {
  log.push(text);
  console.log(text);
  if(iosocket !== undefined) {
    iosocket.emit('log', text);
  }
  //socket.emit('log', text);
}

var routers = [];

function updateRouters() {
  if(iosocket !== undefined) {
    iosocket.emit('routers', { routers: routers});
  }
}

sockets.on('connection', function (socket) {
  var clientipport;
  socket.on('port', function (data) {
    clientipport = data.ip + ':' + data.port;
    routers.push(clientipport);
    consolelog('Ny router: ' + clientipport);
    updateRouters();
  });
  socket.on('end', function() {
    routers.splice(routers.indexOf(clientipport), 1);
    consolelog('Afbrudt router: ' + clientipport);
    updateRouters();
  });
});

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write(JSON.stringify(routers));
  res.end();
  consolelog('En klient downloadede register')
}).listen(HTTPPORT, '0.0.0.0');

var thunder = require('./thunder.js');
http.createServer(function (req, res) {
  thunder.pump('./http/dirserver.html', {ip: IP}, req, res);
}).listen(PRESENTPORT, '0.0.0.0');