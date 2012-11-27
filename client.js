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

var myKey = randomHash();
console.log(myKey);

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
var circuitKeys2 = [];
var somekeys;

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
  
  socket.on('backstream', function(backdata) {
    var decrypted = decrypt2(backdata, myKey);
    //console.dir(JSON.stringify(decrypted));
    if(decrypted.redirect == false) {
      //console.log('Received backstream data!')
      if(decrypted.content.type == 'backkeysok') {
        startEcho(socket);
      } else if(decrypted.content.type == 'message') {
        console.log(decrypted.content.message);
        echoinput(socket);
      } else {
        console.log('Message type was not expected');
      }
    } else {
      console.log('Received unexpected data');
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
    var onion = wrapPkexOnion(message);
    
    var oakMethod = function(data) {
      if(data.type == 'pkex') {
        var shared_secret = hash(alice.computeSecret(data.publickey, 'hex', 'hex'));
        circuitKeys.unshift(shared_secret);
        i++;
        if(i < circuit.length) {
          pkex();
        } else {
          console.log('Circuit ready!');
          console.log(circuitKeys);
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

function decrypt2(text, key) {
  var decipher = crypto.createDecipher('aes-256-cbc',key)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}

var wrapPkexOnion = function(message) {
  if(circuitKeys.length == 0) {
    return message
  } else {
    //var encryptedMessage = encrypt(message, circuitKeys[0]);
    var encryptedMessage = message;
    for(var j = 0; j < circuitKeys.length; j++) {
        
      message = {
        redirect: true,
        next: circuit[circuitKeys.length -j],
        content: encryptedMessage
      }
      
      encryptedMessage = encrypt(message, circuitKeys[j]);
    }
    return encryptedMessage;
  }
}

var wrapOnion = function(message) {
  var encryptedMessage = encrypt(message, circuitKeys[0]);
  //console.log('Encrypting with: ' + circuitKeys[0]);
  for(var j = 0; j < circuitKeys.length - 1; j++) {
        
    message = {
      redirect: true,
      next: circuit[circuitKeys.length - j - 1],
      content: encryptedMessage
    }
    
    //console.log('Encrypting with: ' + circuitKeys[j + 1]); 
    encryptedMessage = encrypt(message, circuitKeys[j + 1]);
  }
  return encryptedMessage;
}

function ask(question, format, callback) {
 var stdin = process.stdin, stdout = process.stdout;
 stdin.resume();
 if(question !== '') {
  stdout.write(question + ": ");
 }
 
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

function getBackKeys(testkeys) {
  testkeys.splice(0,1);
  testkeys.reverse();
  testkeys.unshift(myKey);
  return testkeys;
}

function circuitReady(socket) {
    
    var newkeys = [];
    for(var i = 0; i < circuitKeys.length; i++) {
      newkeys.push(circuitKeys[i]);
    }
    
    //var backkeys = ['lol1', 'lol2', 'lol3'];
    var backkeys = getBackKeys(newkeys);
    console.log('Backkeys:');
    console.log(backkeys);
    
    var message = {
      redirect: false,
      content: {
        type: 'backkeys',
        message: backkeys
      }
    }
    var onion = wrapOnion(message);
    socket.send('tordata', onion);
}

function startEcho(socket) {
  console.log('')
  console.log('ECHO ' + receipient);
  console.log('')
  echoinput(socket);
}

function echoinput(socket) {
    ask('', /.+/, function(data) {
      var message = {
      redirect: false,
        content: {
          type: 'message',
          message: data
        }
      }
      var onion = wrapOnion(message);
      socket.send('tordata', onion);
    });
}