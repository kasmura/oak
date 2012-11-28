function getIP() {
  var myIP;
  var os=require('os');
var ifaces=os.networkInterfaces();
for (var dev in ifaces) {
  var alias=0;
  ifaces[dev].forEach(function(details){
    if (details.family=='IPv4') {
      if(details.address != '127.0.0.1') {
        myIP = details.address;
      }
      ++alias;
    }
  });
}
return myIP;
}
var log = [];
var IP = getIP();;
var HTTPPORT = 8080;
var TCPPORT = 1337;
var PRESENTPORT = 8081;
var SOCKETIOPORT = 8082;

  console.log('OAK DIRECTRORY NODE v0.1');
console.log('- Kasper Rasmussen');
console.log();
consolelog('Kører på oak://' + IP + ':' + TCPPORT);
consolelog('Kører på http://' + IP + ':' + HTTPPORT);
console.log();
console.log('[LOG]');

var sockets = require('./tcp.js').server(TCPPORT);
var http = require('http');
var fs   = require('fs');

var io = require('socket.io').listen(SOCKETIOPORT);
io.set('log level', 1)


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