var sockets = require('./tcp.js').server(1337);
var http = require('http');

var routers = [];

sockets.on('connection', function (socket) {
  var clientipport;
  socket.on('port', function (data) {
    //console.log(data);
    clientipport = socket.remoteAddress + ':' + data;
    routers.push(clientipport);
  });
  socket.on('end', function() {
    //console.log(clientipport + ' closed connection');
    routers.splice(routers.indexOf(clientipport), 1);
  })
});

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write(JSON.stringify(routers));
  res.end();
}).listen(8080, '127.0.0.1');

console.log('Directory-server running at onion://127.0.0.1:1337/');