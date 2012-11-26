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
var bob_secret = undefined; 

router.on('connection', function(socket) {
  console.log('New circuit');
  var nextRouterConnected = false;
  var nextRouter; 
    
  socket.on('tordata', function(data0) {
    var data = data0;
    //if(bob_secret !== undefined) {
    //  console.log(data0);
    //  console.log('bob_secret = ' + bob_secret);
    //  data = decrypt(data0, bob_secret);
    //} else {
    //    data = data0;
    //}
    //console.log(data);
    ////var data = data0;
    if(bob_secret == undefined) {
      console.log(data);
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
      console.log(data);
      data = JSON.parse(decrypt(data, bob_secret));
      console.log('Object: ' + JSON.stringify(data));
      if(nextRouterConnected == false) {
        var next0 = data.next.split(':');
        var next = {ip: next0[0], port: next0[1]}
      
        var sockets = require('./tcp.js').client(next.ip, next.port);
        sockets.on('connection', function(socket2) {
          nextRouter = socket2;
          nextRouterConnected = true;
          nextRouter.on('tordataback', function(backmessage) {
            socket.send('tordataback', backmessage);
          });
          nextRouter.send('tordata', data.content);
        });
      } else {
        nextRouter.send('tordata', data.content);
      }        
    }
  });
});

var OAKDIRIP = '127.0.0.1';
var OAKDIRPORT = 1337
var sockets = require('./tcp.js').client(OAKDIRIP, OAKDIRPORT);
sockets.on('connection', function(socket) {
  socket.send('port', PORT);
  console.log('On network: oak://' + OAKDIRIP + ':' + OAKDIRPORT)
});

function encrypt(text, key) {
  var cipher = crypto.createCipher('aes-256-cbc', key)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text, key) {
  console.log(key);
  var decipher = crypto.createDecipher('aes-256-cbc', key);
  var dec = decipher.update(text,'hex','utf8');
  dec += decipher.final('utf8');
  return dec;
}

function hash(data) {
    var crypto = require('crypto');
    var md5sum = crypto.createHash('md5');
    md5sum.update(data);
    return md5sum.digest('hex');
}