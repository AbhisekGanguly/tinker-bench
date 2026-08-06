/*
 * Tinkerbench — minimal ZIP writer (stored, no compression).
 * Builds a standards-compliant .zip from a list of text files,
 * so students can download index.html + style.css + script.js
 * without any external library.
 */
window.TBZip = (function () {
  'use strict';

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xFF];
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /*
   * files: [{ name: 'folder/file.txt', text: '…' }]
   * returns a Blob of type application/zip
   */
  function build(files) {
    var encoder = new TextEncoder();
    var chunks = [];
    var entries = [];
    var offset = 0;

    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    files.forEach(function (f) {
      var name = encoder.encode(f.name);
      var data = encoder.encode(f.text);
      var crc = crc32(data);

      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);  // local file header signature
      local.setUint16(4, 20, true);          // version needed
      local.setUint16(6, 0x0800, true);      // flags: UTF-8 names
      local.setUint16(8, 0, true);           // method: stored
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); // compressed size (= raw, stored)
      local.setUint32(22, data.length, true); // uncompressed size
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);           // extra field length

      chunks.push(local.buffer, name, data);
      entries.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += 30 + name.length + data.length;
    });

    var centralStart = offset;
    entries.forEach(function (en) {
      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);  // central directory signature
      cd.setUint16(4, 20, true);          // version made by
      cd.setUint16(6, 20, true);          // version needed
      cd.setUint16(8, 0x0800, true);      // flags: UTF-8 names
      cd.setUint16(10, 0, true);          // method: stored
      cd.setUint16(12, dosTime, true);
      cd.setUint16(14, dosDate, true);
      cd.setUint32(16, en.crc, true);
      cd.setUint32(20, en.size, true);
      cd.setUint32(24, en.size, true);
      cd.setUint16(28, en.name.length, true);
      // extra(30), comment(32), disk(34), internal attrs(36), external attrs(38) all zero
      cd.setUint32(42, en.offset, true);
      chunks.push(cd.buffer, en.name);
      offset += 46 + en.name.length;
    });

    var eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);              // end-of-central-directory signature
    eocd.setUint16(8, entries.length, true);          // entries on this disk
    eocd.setUint16(10, entries.length, true);         // entries total
    eocd.setUint32(12, offset - centralStart, true);  // central directory size
    eocd.setUint32(16, centralStart, true);           // central directory offset
    chunks.push(eocd.buffer);

    return new Blob(chunks, { type: 'application/zip' });
  }

  return { build: build };
})();
