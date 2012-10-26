var IP = '127.0.0.1';
var HTTPPORT = 8080;
var TCPPORT = 1337

var sockets = require('./tcp.js').server(TCPPORT);
var http = require('http');

var routers = [];

sockets.on('connection', function (socket) {
  var clientipport;
  socket.on('port', function (data) {
    clientipport = socket.remoteAddress + ':' + data;
    routers.push(clientipport);
    console.log('New router: ' + clientipport)
  });
  socket.on('end', function() {
    routers.splice(routers.indexOf(clientipport), 1);
    console.log('Disconnect: ' + clientipport);
  });
});

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write(JSON.stringify(routers));
  res.end();
}).listen(HTTPPORT, '127.0.0.1');

console.log('OAK DIRECTRORY NODE v0.1');
console.log('- Kasper Rasmussen');
console.log();
console.log('Running on oak://' + IP + ':' + TCPPORT);
console.log('Running on http://' + IP + ':' + HTTPPORT);
console.log();
console.log('[LOG]');