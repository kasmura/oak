var crypto = require('crypto');

var OPTIONS = {
  minRouters: 3,
  circuitSize: 3
}
var circuit;

function handleList(routers) {
  if(routers.length >= OPTIONS.minRouters) {
    circuit = chooseCircuit(routers);
    console.log('Built circuit - size: ' + OPTIONS.circuitSize);
    console.log(circuit);
  }
  client();
}

function chooseCircuit(routers) {
  var list = routers;
  var circuit = [];
  for(var i = 0; i < OPTIONS.circuitSize; i++) {
    var j = Math.floor(Math.random()*list.length);
    circuit.push(list[j]);
    list.splice(j, 1);
  }
  return circuit;
}

var request = require('request');
request('http://127.0.0.1:8080', function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var routers = JSON.parse(body);
    handleList(routers);
  }
});

function client() {
  var circuit0 = circuit[0].split(':');
  var circuit1 = {ip: circuit0[0], port: circuit0[1]}
  console.log(circuit1);
  
  var sockets = require('./tcp.js').client(circuit1.ip, circuit1.port);
  sockets.on('connection', function(socket) {
    encryptCircuit(socket);
  });
}

var oaks = [];

var circuitKeys = [];

// Public-key encryption
var alice = crypto.getDiffieHellman('modp5');
alice.generateKeys('hex')
var alice_public = alice.getPublicKey('hex');

function encryptCircuit(socket) {
  
  var i = 0;
  function pkex() {
    var oakID = randomHash();
    //console.log('OakID: ' + oakID);
    var message = {
      next: circuit[i],
      content: {
        oak: oakID,
        type: 'pkex',
        publickey: alice_public
      }
    }
    for(var j = 0; j < circuitKeys.length; j++) {
      console.log('Encrypting message with: ' + hash(circuitKeys[j]));
      var encryptedMessage = encrypt(message, hash(circuitKeys[j]));
      message = {
        next: circuit[i - j],
        content: encryptedMessage
      }
    }
    var oakMethod = function(data) {
      if(data.type == 'pkex') {
        var shared_secret = alice.computeSecret(data.publickey, 'hex', 'hex');
        console.log('Got key from ' + i);
        circuitKeys.unshift(shared_secret);
        i++;
        pkex();
      }
    }
    oaks.push({
      id: oakID,
      method: oakMethod
    });
    console.log('Sending message');
    console.dir(message);
    socket.send('tordata', message);
  }
  
  socket.on('tordataback', function(data) {
    //console.log('Got back-message');
    for(var i = 0; i < oaks.length; i++) {
      //console.log(oaks[i]['id'] + ' == ' + data.oak + ' ?');
      if(oaks[i]['id'] == data.oak)
        oaks[i].method(data);
      break;
    }
  });
  
  pkex();
}

function hash(data) {
    var crypto = require('crypto');
    var md5sum = crypto.createHash('md5');
    md5sum.update(data);
    return md5sum.digest('hex');
}

function randomString() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = 10;
    var randomstring = '';
    for (var i=0; i<string_length; i++) {
	var rnum = Math.floor(Math.random() * chars.length);
	randomstring += chars.substring(rnum,rnum+1);
    }
    return randomstring;
}

function randomHash() {
  var random = randomString();
  return hash(random);
}

function encrypt(text, key){
  var cipher = crypto.createCipher('aes-256-cbc',key);
  var crypted = cipher.update(JSON.stringify(text),'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text, key){
  var decipher = crypto.createDecipher('aes-256-cbc',key)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}