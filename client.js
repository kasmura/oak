var crypto = require('crypto');
var log = [];

var OPTIONS = {
  minRouters: 3,
  circuitSize: 3
}
var circuit;
var receipient;

var myKey = randomHash();
console.log(myKey);

function handleList(routers, receipient2) {
  if(routers.length >= OPTIONS.minRouters) {
    circuit = chooseCircuit(routers);
    consolelog('Bygger bane...');
    receipient = receipient2;
    circuit.push(receipient);
    client();
  } else {
    consolelog('Netværkets kapacitet er ikke stor nok');
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


function getDirectory(network, receipient) {
  var request = require('request');
  consolelog('Forbinder til netværk: ' + network);
  request('http://' + network, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var routers = JSON.parse(body);
      iosocket.emit('connected');
      handleList(routers, receipient);
    }
  });
}

var socket;

function client() {
  //consolelog(circuit);
  var circuit0 = circuit[0].split(':');
  var circuit1 = {ip: circuit0[0], port: circuit0[1]}
  
  var sockets = require('./tcp.js').client(circuit1.ip, circuit1.port);
  sockets.on('connection', function(socket0) {
    socket = socket0;
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
        consolelog('Modtager: ' + decrypted.content.message);
        echoinput(socket);
      } else {
        consolelog('Beskeden-typen var ikke forventet');
      }
    } else {
      consolelog('Modtog uforventet data');
    }
  });

  consolelog('Krypterer bane...');
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
        var progress = circuitKeys.length / circuit.length * 100;
        iosocket.emit('test', progress);
        i++;
        if(i < circuit.length) {
          pkex();
        } else {
          consolelog('Klar bane!');
          //consolelog(circuitKeys);
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
    //consolelog('Backkeys:');
    //consolelog(backkeys);
    
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
  consolelog('')
  consolelog('ECHO ' + receipient);
  consolelog('')
  echoinput(socket);
}

function echoinput(socket) {
    ask('', /.+/, function(data) {
      consolelog('Klient: ' + data);
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

var PRESENTPORT  = 8030;
var SOCKETIOPORT = 8031;

var io = require('socket.io').listen(SOCKETIOPORT);
io.set('log level', 1)

var iosocket = undefined;
io.sockets.on('connection', function (socket0) {
  iosocket = socket0;
  iosocket.on('establishconnection', function(data) {
    getDirectory(data.network, data.receipient);
  });
  iosocket.on('sendmessage', function(data) {
        consolelog('Klient: ' + data);
      var message = {
      redirect: false,
        content: {
          type: 'message',
          message: data
        }
      }
      var onion = wrapOnion(message);
      socket.send('tordata', onion);
  })
  iosocket.emit('previous', { log: log });
});

function consolelog(text) {
  log.push(text);
  console.log(text);
  if(socket !== undefined) {
    iosocket.emit('log', text);
  }
}

var getNetworkIP = (function () {
    var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

    var exec = require('child_process').exec;
    var cached;    
    var command;
    var filterRE;

    switch (process.platform) {
    // TODO: implement for OSs without ifconfig command
    case 'darwin':
         command = 'ifconfig';
         filterRE = /\binet\s+([^\s]+)/g;
         // filterRE = /\binet6\s+([^\s]+)/g; // IPv6
         break;
    default:
         command = 'ifconfig';
         filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
         // filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
         break;
    }

    return function (callback, bypassCache) {
         // get cached value
        if (cached && !bypassCache) {
            callback(null, cached);
            return;
        }
        // system call
        exec(command, function (error, stdout, sterr) {
            var ips = [];
            // extract IPs
            var matches = stdout.match(filterRE);
            // JS has no lookbehind REs, so we need a trick
            for (var i = 0; i < matches.length; i++) {
                ips.push(matches[i].replace(filterRE, '$1'));
            }

            // filter BS
            for (var i = 0, l = ips.length; i < l; i++) {
                if (!ignoreRE.test(ips[i])) {
                    //if (!error) {
                        cached = ips[i];
                    //}
                    callback(error, ips[i]);
                    return;
                }
            }
            // nothing found
            callback(error, null);
        });
    };
})();

var http = require('http');
var thunder = require('./thunder.js');
http.createServer(function (req, res) {
  getNetworkIP(function (error, ip0) {
    thunder.pump('./http/client.html', {ip: ip0}, req, res);
    if (error) {
        console.log('error:', error);
    }
}, false);
}).listen(PRESENTPORT, '0.0.0.0');


getNetworkIP(function (error, ip) {
  console.log('OAK CLIENT v0.1');
console.log('- Kasper Rasmussen');
console.log();
consolelog('Kører på http://' + ip + ':' + PRESENTPORT);
console.log('[LOG]'); 
});
