# Oak

Oak is Node.js project delivering an anonymous and secure network between nodes. It uses encrypted JSON-onions to make
all communication untracable and obscured.

**This is the planned result of oak:**
### Client
```js
var client = require('oak').client();
client.network = 'oak://127.0.0.1:4321';

client.on('connection', function(socket) {
  socket.on('news', function (data) {
    console.log(data);
    socket.send('myEvent', { my: 'data'});
  });    
});

client.connect('127.0.0.1:1234');
```

### Server
```js
var server = require('oak').server();
server.network = 'oak://127.0.0.1:4321';

server.on('connection', function (socket) {
  socket.send('news', { hello: 'world'});
  socket.on('myEvent', function (data) {
    console.log(data);
  });
});

server.listen('127.0.0.1:1234')
```

## Model

### Router
A oak-network consists of various routers that together enable a user of the network to anonymize and secure
his communication. It receives information and redirects it to the next router in the circuit.

### Directory-server
The routers are connected to a central-server were they report that they are a part of the network.
This server is called a directory-server and has a list of the routers in the network. The client can connect to the
directory-server, and download the list to build a circuit from. Directory-servers are a tempory component of Oak
and should be replaced by a distributed list of routers, so that the network will be more balanced and secure.

### Circuit
The client chooses random routers from the list, and builds a circuit through which the data can travel.
It exchanges keys with the routers in the circuit, and when the client has keys for all the routers, it can built
an onion-object when it wants to send data.

### Onion-objects
An onion-object is data encrypted multiple times, so that each router decrypt the onion, thus metaphorically peeling
a layer of the onion, with his own key, and sends the rest down the circuit, until it reaches it's destination.

## Implementation

The model described above, is what is trying to be implemented using node.js. Communication between clients and routers,
and routers and dir-server are TCP. For TCP the tcp.js library is used. Router-lists are served by the dir-server through
HTTP.

## Status

### Done 
Client downloads router-list and builds circuit

Exchanging keys with all routers in circuit

Experimental communication with last-node

### Currently
Backstream communication
Enabling encryption
