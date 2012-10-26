console.log('OAK CLIENT v0.1');
console.log('- Kasper Rasmussen');
console.log();
console.log('[LOG]');

var crypto = require('crypto');

var OPTIONS = {
  minRouters: 3,
  circuitSize: 3
}
var circuit;
var receipient;


function handleList(routers) {
  console.log('Building circuit...');
  if(routers.length >= OPTIONS.minRouters) {
    circuit = chooseCircuit(routers);
    ask('Receipient', /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\:[0-9]{1,5}/, function(receipient2) {
      receipient = receipient2;
      circuit.push(receipient);
      client();
    });
  } else {
    console.log('Network size not big enough');
  }
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
console.log('Connecting to OAK-network: http://127.0.0.1:8080')
request('http://127.0.0.1:8080', function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var routers = JSON.parse(body);
    handleList(routers);
  }
});

function client() {
  console.log(circuit);
  var circuit0 = circuit[0].split(':');
  var circuit1 = {ip: circuit0[0], port: circuit0[1]}
  
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

  socket.on('tordataback', function(data) {
    for(var i = 0; i < oaks.length; i++) {
      if(oaks[i]['id'] == data.oak) {
        oaks[i].method(data);
      }
    }
  });

  console.log('Encrypting circuit...');
  var i = 0;
  function pkex() {
    var oakID = randomHash();
    
    var message = {
      redirect: false,
      content: {
        oak: oakID,
        type: 'pkex',
        publickey: alice_public
      }
    }
    var onion = wrapOnion(i, circuitKeys.length, message);
    
    var oakMethod = function(data) {
      if(data.type == 'pkex') {
        var shared_secret = alice.computeSecret(data.publickey, 'hex', 'hex');
        circuitKeys.unshift(hash(shared_secret));
        i++;
        if(i < circuit.length) {
          pkex();
        } else {
          console.log('Circuit ready!');
          circuitReady(socket);
        }
      }
    }
    oaks.push({
      id: oakID,
      method: oakMethod
    });
    socket.send('tordata', onion);
  }
  
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
    var string_length = 15;
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

function wrapOnion(i, ckl,message) {
  for(var j = 0; j + 1 <= ckl; j++) {
    //var encryptedMessage = message
    var encryptedMessage = encrypt(message, circuitKeys[j]);
    if(j == i) {
      message = {
        redirect: true,
        content: encryptedMessage
      }
    } else {
      message = {
        redirect: true,
        next: circuit[i - j],
        content: encryptedMessage
      }        
    }
  }
  return message;
}

function ask(question, format, callback) {
 var stdin = process.stdin, stdout = process.stdout;
 
 stdin.resume();
 stdout.write(question + ": ");
 
 stdin.once('data', function(data) {
   data = data.toString().trim();
 
   if (format.test(data)) {
     callback(data);
   } else {
     stdout.write("It should match: "+ format +"\n");
     ask(question, format, callback);
   }
 });
}

function circuitReady(socket) {
  ask('Send', /.+/, function(data) {
    var message = {
      redirect: false,
      content: {
        type: 'message',
        message: data
      }
    }
    var onion = wrapOnion(3, circuitKeys.length - 1, message);
    socket.send('tordata', onion);
  });
}