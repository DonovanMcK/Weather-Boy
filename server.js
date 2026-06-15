#!/usr/bin/env node
/* ===========================================================================
   TOTENSTURM — local server + phone-controller relay
   Run:  node server.js   (optionally PORT=1234 node server.js)

   Serves the game to this computer and a touch controller to your phone, and
   relays the phone's input to the game over a tiny WebSocket. Both devices must
   be on the same Wi-Fi. No dependencies — pure Node.

   The game still runs standalone (just open index.html); this server is only
   needed when you want to use a phone as the gamepad.
   =========================================================================== */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var os = require('os');

var ROOT = __dirname;
var PORT = process.env.PORT ? +process.env.PORT : 8080;

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2'
};

function lanIP() {
  var ifs = os.networkInterfaces();
  for (var name in ifs) {
    var addrs = ifs[name] || [];
    for (var i = 0; i < addrs.length; i++) {
      var a = addrs[i];
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return '127.0.0.1';
}
var LAN = lanIP();

/* --------------------------------------------------------- static files */
var server = http.createServer(function (req, res) {
  var url = req.url.split('?')[0];
  if (url === '/info') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ lan: LAN, port: PORT, padUrl: 'http://' + LAN + ':' + PORT + '/pad' }));
    return;
  }
  if (url === '/') url = '/index.html';
  if (url === '/pad' || url === '/pad/') url = '/pad.html';
  var file = path.normalize(path.join(ROOT, decodeURIComponent(url)));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

/* ---------------------------------- minimal WebSocket relay (RFC 6455) */
var GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
var clients = [];   // { sock, role: 'game' | 'pad' | null }

function frame(str) {
  var payload = Buffer.from(str), len = payload.length, header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len >>> 0, 6); }
  return Buffer.concat([header, payload]);
}
function send(sock, str) { try { sock.write(frame(str)); } catch (e) {} }
function broadcast(fromRole, str) {
  var target = fromRole === 'pad' ? 'game' : 'pad';
  for (var i = 0; i < clients.length; i++) if (clients[i].role === target) send(clients[i].sock, str);
}
function notifyPeers() {
  var hasGame = clients.some(function (c) { return c.role === 'game'; });
  var hasPad = clients.some(function (c) { return c.role === 'pad'; });
  var st = JSON.stringify({ a: 'peers', game: hasGame, pad: hasPad });
  clients.forEach(function (c) { if (c.role) send(c.sock, st); });
}

server.on('upgrade', function (req, sock) {
  var key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  var accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');

  var client = { sock: sock, role: null };
  clients.push(client);
  var buf = Buffer.alloc(0);

  sock.on('data', function (chunk) {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      var b2 = buf[1];
      var opcode = buf[0] & 0x0f, masked = (b2 & 0x80) !== 0, len = b2 & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) break; len = buf.readUInt32BE(6); off = 10; }
      var dataOff = off + (masked ? 4 : 0);
      if (buf.length < dataOff + len) break;
      var data = Buffer.alloc(len);
      if (masked) { var m = buf.slice(off, off + 4); for (var i = 0; i < len; i++) data[i] = buf[dataOff + i] ^ m[i & 3]; }
      else buf.copy(data, 0, dataOff, dataOff + len);
      buf = buf.slice(dataOff + len);

      if (opcode === 0x8) { try { sock.end(); } catch (e) {} return; }   // close
      if (opcode !== 0x1) continue;                                       // text only
      var str = data.toString('utf8'), msg;
      try { msg = JSON.parse(str); } catch (e) { continue; }
      if (msg.a === 'hello') { client.role = msg.role === 'pad' ? 'pad' : 'game'; notifyPeers(); continue; }
      if (client.role) broadcast(client.role, str);
    }
  });
  function gone() {
    var ix = clients.indexOf(client);
    if (ix >= 0) { clients.splice(ix, 1); notifyPeers(); }
  }
  sock.on('close', gone);
  sock.on('error', gone);
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('\n  ☢  TOTENSTURM server running');
  console.log('  ───────────────────────────────────────────');
  console.log('  Play on this computer:  http://localhost:' + PORT + '/');
  console.log('  Phone controller:       http://' + LAN + ':' + PORT + '/pad');
  console.log('  (the phone must be on the same Wi-Fi network)\n');
});
