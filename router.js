var crypto = require('crypto');
var PORT = process.argv[2];
var ME = '127.0.0.1:' + PORT;

var router = require('./tcp.js').server(PORT);

var bob = crypto.getDiffieHellman('modp5');
bob.generateKeys('hex');
var bob_secret;

router.on('connection', function(socket) {
  var nextRouterConnected = false;
  var nextRouter; 
    
  socket.on('tordata', function(data) {
    console.log('Incoming tordata');
    if(data.next !== ME) {
      if(nextRouterConnected == false) {
        var next0 = data.next.split(':');
        var next = {ip: next0[0], port: next0[1]}
      
        var sockets = require('./tcp.js').client(next.ip, next.port);
        sockets.on('connection', function(socket2) {
          nextRouter = socket;
          nextRouterConnected = true;
          nextRouter.on('tordataback', function(backmessage) {
            socket.send('tordataback', backmessage);
          });
          console.log('Decrypting with: ' + hash(bob_secret));
          var decryptedMessage = decrypt(data.content, hash(bob_secret));
          console.log('Decrypted message:');
          console.dir(decryptedMessage);
          nextRouter.send('tordata', decryptedMessage);
          console.log('Has send data');
        });
      } else {
        console.log('Decrypting with: ' + hash(bob_secret));
        var decryptedMessage = decrypt(data.content, hash(bob_secret));
        console.log('Decrypted message:');
        console.dir(decryptedMessage);
        nextRouter.send('tordata', decryptedMessage);
        console.log('Has send data');
      }
    } else {
      //console.log(data.content);
      if(data.content.type == 'pkex') {
        console.log('Got key from previous')
        bob_secret = bob.computeSecret(data.content.publickey, 'hex', 'hex');
        //console.log(bob_secret); 
        //console.log('Displayed secret');
        var bob_publickey = bob.getPublicKey('hex');
        //console.log(data);
        var backmessage = {
          oak: data.content.oak,
          type: 'pkex',
          publickey: bob_publickey
        }
        //console.log('Sending data back');
        socket.send('tordataback', backmessage);
      } else {
        console.log('Received unexpected data');
      }
    }
  });
  console.log('New connection from a previous');
});

var sockets = require('./tcp.js').client('127.0.0.1', 1337);
sockets.on('connection', function(socket) {
  socket.send('port', PORT);
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