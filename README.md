# Tolstoy

Tolstoy is a first and foremost a experiment. It is experiment to implement a network with secure and anonymous
communication between peers. It aims to archieve this goal by implementing the onion routing model that will
be explained below.

## Model

### Router
A tolstoy-network consists of various routers that together enable a user of the network to anonymize and secure
his communication. It receives information and redirects it to the next router in the circuit.

### Directory-server
The routers are connected to a central-server were they report that they are a part of the network.
This server is called a directory-server and has a list of the routers in the network. The client can connect to the
directory-server, and download the list to build a circuit from. Directory-servers are a tempory component of Tolstoy
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

Done: Client downloads router-list and builds circuit

Currently: Exchanging keys with all routers in circuit