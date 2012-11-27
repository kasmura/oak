var fs = require('fs');
var http = require('http');
var thunder = require('thunder');

module.exports.pump = function(file, order, req, res) {
  fs.readFile(file, 'ascii', function(err,input){
    if(err) {
      console.error("Could not open file: %s", err);
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('Error');
      res.end();
    }
    var locals  = order;
    var options = {
      cached   : true,
      compress : true
    };
    var output = thunder.render(input, locals, options);
            
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(output);
    res.end();
  });
}