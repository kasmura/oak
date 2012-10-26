console.log('OAK ROUTER v0.1');
console.log('- Kasper Rasmussen');
console.log();
console.log('[LOG]');

var crypto = require('crypto');
var PORT = process.argv[2];
var ME = '127.0.0.1:' + PORT;

var router = require('./tcp.js').server(PORT);

var bob = crypto.getDiffieHellman('modp5');
bob.generateKeys('hex');
var bob_secret;

router.on('connection', function(socket) {
    
  socket.on('tordata', function(data) {
    if(data.redirect == false) {
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
      } else if(data.content.type == 'message') {
        console.log(data.content.message);
      } else {
        console.log('Received unexpected data');
      }
    }
  });
});

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