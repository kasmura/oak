function getIP() {
  var myIP;
  var os=require('os');
var ifaces=os.networkInterfaces();
for (var dev in ifaces) {
  var alias=0;
  ifaces[dev].forEach(function(details){
    if (details.family=='IPv4') {
      if(details.address != '127.0.0.1') {
        myIP = details.address;
      }
      ++alias;
    }
  });
}
return myIP;
}
var IP = getIP();
var routerID = parseInt(process.argv[2]);
console.log(routerID);
var crypto = require('crypto');
var PORT = 1440 + routerID;

var router = require('./tcp.js').server(PORT);

var bob = crypto.getDiffieHellman('modp5');
bob.generateKeys('hex');
var bob_secret = undefined; 

router.on('connection', function(socket) {
  consolelog('Ny bane');
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
        consol.log('Modtog uforventet data');
      }   
    } else {
      data = JSON.parse(decrypt(data, bob_secret));
      if(nextRouterConnected == false) {
        var next0 = data.next.split(':');
        var next = {ip: next0[0], port: next0[1]}
      
        var sockets = require('./tcp.js').client(next.ip, next.port);
        sockets.on('connection', function(socket2) {
          nextRouter = socket2;
          nextRouterConnected = true;
          nextRouter.on('backstream', function(backmessage) {
            var decrypted = decrypt2(backmessage, bob_secret);
            //console.dir(JSON.stringify(decrypted));
            if(decrypted.redirect == true) {
                socket.send('backstream', decrypted.content);
            }
          });
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

var OAKDIRIP = process.argv[3];
var OAKDIRPORT = 1337
var sockets = require('./tcp.js').client(OAKDIRIP, OAKDIRPORT);
sockets.on('connection', function(socket) {
    socket.send('port', {port: PORT, ip: IP});
    consolelog('På register: ' + OAKDIRIP + ':' + OAKDIRPORT);
});

function encrypt(text, key) {
  var cipher = crypto.createCipher('aes-256-cbc', key)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text, key) {
  var decipher = crypto.createDecipher('aes-256-cbc', key);
  var dec = decipher.update(text,'hex','utf8');
  dec += decipher.final('utf8');
  return dec;
}

function decrypt2(text, key) {
  var decipher = crypto.createDecipher('aes-256-cbc',key)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}

function hash(data) {
    var crypto = require('crypto');
    var md5sum = crypto.createHash('md5');
    md5sum.update(data);
    return md5sum.digest('hex');
}


var PRESENTPORT = 8010 + routerID;
var SOCKETIOPORT = 8020 + routerID;

var io = require('socket.io').listen(SOCKETIOPORT);
io.set('log level', 1)
var log = [];

var socket = undefined;
io.sockets.on('connection', function (socket0) {
  socket0.emit('previous', { log: log });
  socket = socket0;
});

function consolelog(text) {
  log.push(text);
  console.log(text);
  if(socket !== undefined) {
    socket.emit('log', text);
  }
  //socket.emit('log', text);
}

var http = require('http');
var thunder = require('./thunder.js');
http.createServer(function (req, res) {
    thunder.pump('./http/router.html', { ip: IP, router: routerID}, req, res);
}).listen(PRESENTPORT, '0.0.0.0');

console.log('OAK ROUTER v0.1');
console.log('- Kasper Rasmussen');
console.log();
console.log('[LOG]');