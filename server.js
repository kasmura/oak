console.log('OAK SERVER v0.1');
console.log('- Kasper Rasmussen');
console.log();
console.log('[LOG]');

var crypto = require('crypto');
var PORT = process.argv[2];
var ME = '127.0.0.1:' + PORT;

var circuitKeys;

var router = require('./tcp.js').server(PORT);

var bob = crypto.getDiffieHellman('modp5');
bob.generateKeys('hex');
var bob_secret = undefined;

router.on('connection', function(socket) {
    
  socket.on('tordata', function(data0) {
    var data = data0;
    if(bob_secret == undefined) {
      if(data.content.type == 'pkex') {
        bob_secret = hash(bob.computeSecret(data.content.publickey, 'hex', 'hex'));
        console.log('My key: ' + bob_secret);
        var bob_publickey = bob.getPublicKey('hex');
        var backmessage = {
          oak: data.content.oak,
          type: 'pkex',
          publickey: bob_publickey
        }
        socket.send('tordataback', backmessage);
      } else {
        console.log('Received unexpected data');
      }   
    } else {
      data = JSON.parse(decrypt(data, bob_secret));
      if(data.content.type == 'message') {
        console.log('Input: ' + data.content.message);
        var response = data.content.message;
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
        console.log('My backkeys are:');
        console.log(data.content.message);
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