var IP;

var crypto = require('crypto');
var PORT = process.argv[2];
var log = [];

var circuitKeys;

var router = require('./tcp.js').server(PORT);

var bob = crypto.getDiffieHellman('modp5');
bob.generateKeys('hex');
var bob_secret = undefined;

function reverse(s){
    return s.split("").reverse().join("");
}

router.on('connection', function(socket) {
  consolelog('Ny forbindelse');
  socket.on('tordata', function(data0) {
    var data = data0;
    if(bob_secret == undefined) {
      if(data.content.type == 'pkex') {
        bob_secret = hash(bob.computeSecret(data.content.publickey, 'hex', 'hex'));
        consolelog('Min nøgle: ' + bob_secret);
        var bob_publickey = bob.getPublicKey('hex');
        var backmessage = {
          oak: data.content.oak,
          type: 'pkex',
          publickey: bob_publickey
        }
        socket.send('tordataback', backmessage);
      } else {
        consolelog('Modtog uforventet data');
      }   
    } else {
      data = JSON.parse(decrypt(data, bob_secret));
      if(data.content.type == 'message') {
        consolelog('Besked: ' + data.content.message);
        var response = reverse(data.content.message);
        var message = {
            redirect: false,
            datamessage: true,
            content: {
                type: 'message',
                message: response
            }
        }
        var onion = wrapOnion(message);
        socket.send('backstream', onion);
      } else if(data.content.type == 'backkeys') {
        circuitKeys = data.content.message;
        var message = {
          redirect: false,
          content: {
            type: 'backkeysok',
            message: 'success'
          }
        }
        var onion = wrapOnion(message);
        socket.send('backstream', onion);
      }
    }
  });
});

var wrapOnion = function(message) {
  var encryptedMessage = encrypt2(message, circuitKeys[0]);
  //console.log('Encrypting with: ' + circuitKeys[0]);
  for(var j = 0; j < circuitKeys.length - 1; j++) {
        
    message = {
      redirect: true,
      content: encryptedMessage
    }
    
    //console.log('Encrypting with: ' + circuitKeys[j + 1]); 
    encryptedMessage = encrypt2(message, circuitKeys[j + 1]);
  }
  return encryptedMessage;
}

function encrypt2(text, key) {
  var cipher = crypto.createCipher('aes-256-cbc',key);
  var crypted = cipher.update(JSON.stringify(text),'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt2(text, key) {
  var decipher = crypto.createDecipher('aes-256-cbc',key)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}

function encrypt(text, key){
  var cipher = crypto.createCipher('aes-256-cbc',key)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text, key){
  var decipher = crypto.createDecipher('aes-256-cbc',key)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

function hash(data) {
    var crypto = require('crypto');
    var md5sum = crypto.createHash('md5');
    md5sum.update(data);
    return md5sum.digest('hex');
}

var PRESENTPORT  = 8040;
var SOCKETIOPORT = 8041;

var io = require('socket.io').listen(SOCKETIOPORT);
io.set('log level', 1);

var iosocket = undefined;
io.sockets.on('connection', function (socket0) {
  iosocket = socket0;
  iosocket.emit('previous', { log: log });
});

function consolelog(text) {
  log.push(text);
  console.log(text);
  if(iosocket !== undefined) {
    iosocket.emit('log', text);
  }
}

var http = require('http');
var thunder = require('./thunder.js');
http.createServer(function (req, res) {
  thunder.pump('./http/server.html', {ip: IP}, req, res);
}).listen(PRESENTPORT, '0.0.0.0');

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

getNetworkIP(function (error, ip0) {
  IP = ip0;
console.log('OAK SERVER v0.1');
console.log('- Kasper Rasmussen');
console.log();
consolelog('Kører på oak://' + IP + ':' + PORT);
consolelog('Kører på http://' + IP + ':' + PRESENTPORT);
console.log();
console.log('[LOG]');
    if (error) {
        console.log('error:', error);
    }
}, false);