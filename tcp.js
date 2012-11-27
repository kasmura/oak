
// Event emitters
var events = require('events');
// Prototypes
var util = require('util');
// Adding send method to socket object
var _ = require("underscore");
// TCP functionality
var net = require('net');

var LOGMODE = false;

// For initalilising a new TCP server
function server(port) {
    
    // TCP host is default to 127.0.0.1
    var HOST = '127.0.0.1';
    // Server port has to be specified
    var PORT = port;
    
    // New event object, only used for connection event,
    // when a new client connects
    var Sockets = function(){
      events.EventEmitter.call(this);
      
      function emit(event, data) {
        if(data) {
            this.emit(event, data);
        } else {
            this.emit(event);
        }
      }
    };
    // Add event functionality
    util.inherits(Sockets, events.EventEmitter);
    // Init a new sockets object
    var sockets = new Sockets();
    
    // Create the tcp server
    var server = net.createServer(function (socket0) {
      
      // The socket also has to have a event functionality
      socket0.prototype = Object.create(events.EventEmitter.prototype);
      
      // For sending data to clients
      // It has built-in JSON encoding
      function send(event, data) {
        var message;
        if(data) {
          message = {
            event: event,
            content: data
          } 
        } else {
          message = {
            event: event
          }
        }
        tcpjsLog('tcp.js: Sending data');
        socket.write(JSON.stringify(message));
      }
      
      var extraproto = {
        send: send
      };
      var socket = _.extend(socket0, extraproto);
      
      tcpjsLog('tcp.js: New - ' + socket.remoteAddress + ':' + socket.remotePort);
      
      sockets.emit('connection', socket);
      
      // Add a 'data' event handler to this instance of socket
      socket.on('data', function(data) {
        var message = JSON.parse(data);
        if(message.event && message.content)
          socket.emit(message.event, message.content);
        else
          tcpjsLog('Invalid message');
      });
    });
    
    server.listen(PORT, HOST);
    tcpjsLog('tcp.js: Running on ' + HOST + ':' + PORT);
    
    return sockets;
}
module.exports.server = server;

function client(host, port) {
    var Sockets = function(){
      events.EventEmitter.call(this);
      this.setMaxListeners(0);
      function emit(event, data) {
        if(data) {
            this.emit(event, data);
        } else {
            this.emit(event);
        }
      }
    };
    util.inherits(Sockets, events.EventEmitter);
    var sockets = new Sockets();
    
    var HOST = host;
    var PORT = port;
    
    var client = new net.Socket();
    
    function send(event, data) {
      var message;
      if(data) {
        message = {
          event: event,
          content: data
        } 
      } else {
        message = {
          event: event
        }
      }
      tcpjsLog('tcp.js: Sending data');
      client.write(JSON.stringify(message));
    }
    
    var socket0 = new Sockets();
    var extraproto = {
      send: send
    };
    
    socket = _.extend(socket0, extraproto);
    
    client.connect(PORT, '127.0.0.1', function() {
      tcpjsLog('tcp.js: Connected to ' + HOST + ':' + PORT);
      sockets.emit('connection', socket);
    });
    
    
    client.on('data', function(data) {
      tcpjsLog('tcp.js: New data');
      var message = JSON.parse(data);
      if(message.event && message.content)
        socket.emit(message.event, message.content);
      else
        tcpjsLog('Invalid message');
    });
    
    return sockets;
}
module.exports.client = client;

function tcpjsLog(data) {
    if(LOGMODE == true)
      console.log(data);
}