var IP = '127.0.0.1';
var HTTPPORT = 8080;
var TCPPORT = 1337;
var PRESENTPORT = 8081
var SOCKETIOPORT = 8082

var sockets = require('./tcp.js').server(TCPPORT);
var http = require('http');
var fs   = require('fs');

var io = require('socket.io').listen(SOCKETIOPORT);
io.set('log level', 1)
var log = [];


var socket = undefined;
io.sockets.on('connection', function (socket0) {
  socket0.emit('previous', { log: log });
  socket = socket0;
  updateRouters();
});

function consolelog(text) {
  log.push(text);
  console.log(text);
  if(socket !== undefined) {
    socket.emit('log', text);
  }
  //socket.emit('log', text);
}

var routers = [];

function updateRouters() {
  socket.emit('routers', { routers: routers});
}

sockets.on('connection', function (socket) {
  var clientipport;
  socket.on('port', function (data) {
    clientipport = socket.remoteAddress + ':' + data;
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
}).listen(HTTPPORT, '127.0.0.1');

http.createServer(function (req, res) {
  fs.readFile('./http/dirserver.html', 'ascii', function(err,content){
    if(err) {
      console.error("Could not open file: %s", err);
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('Error');
      res.end();
    }            
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(content);
    res.end();
  });  
}).listen(PRESENTPORT, '127.0.0.1');

console.log('OAK DIRECTRORY NODE v0.1');
console.log('- Kasper Rasmussen');
console.log();
consolelog('Kører på oak://' + IP + ':' + TCPPORT);
consolelog('Kører på http://' + IP + ':' + HTTPPORT);
console.log();
console.log('[LOG]');