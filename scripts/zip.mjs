import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_RECORD_SIZE = 46;
const END_RECORD_SIZE = 22;
const VERSION = 20;
const UTF8_FLAG = 0x0800;
const DEFLATE = 8;
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const MIN_ZIP_YEAR = 1980;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function collectFiles(dir, base = dir) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = resolve(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...collectFiles(path, base));
    } else {
      files.push({ path, name: relative(base, path).split(sep).join('/') });
    }
  }
  return files;
}

function dosTimestamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function archiveDate() {
  const epoch = Number.parseInt(process.env.SOURCE_DATE_EPOCH ?? '', 10);
  const date = Number.isFinite(epoch) ? new Date(epoch * 1000) : new Date();
  return date.getFullYear() < MIN_ZIP_YEAR ? new Date(MIN_ZIP_YEAR, 0, 1) : date;
}

function localHeader(stamp, checksum, compressed, uncompressed, nameLength) {
  const header = Buffer.alloc(LOCAL_HEADER_SIZE);
  header.writeUInt32LE(LOCAL_SIGNATURE, 0);
  header.writeUInt16LE(VERSION, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(DEFLATE, 8);
  header.writeUInt16LE(stamp.time, 10);
  header.writeUInt16LE(stamp.day, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(compressed, 18);
  header.writeUInt32LE(uncompressed, 22);
  header.writeUInt16LE(nameLength, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralRecord(stamp, checksum, compressed, uncompressed, nameLength, offset) {
  const record = Buffer.alloc(CENTRAL_RECORD_SIZE);
  record.writeUInt32LE(CENTRAL_SIGNATURE, 0);
  record.writeUInt16LE(VERSION, 4);
  record.writeUInt16LE(VERSION, 6);
  record.writeUInt16LE(UTF8_FLAG, 8);
  record.writeUInt16LE(DEFLATE, 10);
  record.writeUInt16LE(stamp.time, 12);
  record.writeUInt16LE(stamp.day, 14);
  record.writeUInt32LE(checksum, 16);
  record.writeUInt32LE(compressed, 20);
  record.writeUInt32LE(uncompressed, 24);
  record.writeUInt16LE(nameLength, 28);
  record.writeUInt16LE(0, 30);
  record.writeUInt16LE(0, 32);
  record.writeUInt16LE(0, 34);
  record.writeUInt16LE(0, 36);
  record.writeUInt32LE(0, 38);
  record.writeUInt32LE(offset, 42);
  return record;
}

export function createZip(sourceDir, outFile) {
  const stamp = dosTimestamp(archiveDate());
  const files = collectFiles(sourceDir);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = readFileSync(file.path);
    const compressed = deflateRawSync(data, { level: 9 });
    const name = Buffer.from(file.name, 'utf8');
    const checksum = crc32(data);

    localParts.push(localHeader(stamp, checksum, compressed.length, data.length, name.length));
    localParts.push(name, compressed);
    centralParts.push(
      centralRecord(stamp, checksum, compressed.length, data.length, name.length, offset),
    );
    centralParts.push(name);

    offset += LOCAL_HEADER_SIZE + name.length + compressed.length;
  }

  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);

  const end = Buffer.alloc(END_RECORD_SIZE);
  end.writeUInt32LE(END_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 18);

  writeFileSync(outFile, Buffer.concat([localData, centralData, end]));
  return {
    entries: files.length,
    bytes: localData.length + centralData.length + END_RECORD_SIZE,
  };
}
