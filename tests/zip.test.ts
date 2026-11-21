import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { writeZip } from '../scripts/zip.mjs';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const CENTRAL_RECORD_SIZE = 46;
const END_RECORD_SIZE = 22;

interface ParsedEntry {
  offset: number;
  name: string;
  data: Buffer;
}

function readEntries(archive: Buffer): { entries: ParsedEntry[]; centralOffset: number } {
  const entries: ParsedEntry[] = [];
  let offset = 0;
  while (offset + 4 <= archive.length && archive.readUInt32LE(offset) === LOCAL_SIGNATURE) {
    const compressed = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    entries.push({
      offset,
      name: archive.toString('utf8', nameStart, nameStart + nameLength),
      data: inflateRawSync(archive.subarray(dataStart, dataStart + compressed)),
    });
    offset = dataStart + compressed;
  }
  return { entries, centralOffset: offset };
}

describe('writeZip', () => {
  it('round-trips entries and points the central directory at each local header', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ytb-zip-'));
    const first = join(dir, 'a.txt');
    const second = join(dir, 'b.bin');
    const archivePath = join(dir, 'out.zip');
    writeFileSync(first, 'hello');
    writeFileSync(second, 'world');

    const result = writeZip(
      [
        { path: first, name: 'a.txt' },
        { path: second, name: 'nested/b.bin' },
      ],
      archivePath,
    );

    const archive = readFileSync(archivePath);
    expect(result.entries).toBe(2);
    expect(result.bytes).toBe(archive.length);

    const { entries, centralOffset } = readEntries(archive);
    expect(entries.map((entry) => entry.name)).toEqual(['a.txt', 'nested/b.bin']);
    expect(entries.map((entry) => entry.data.toString('utf8'))).toEqual(['hello', 'world']);
    expect(archive.readUInt32LE(centralOffset)).toBe(CENTRAL_SIGNATURE);

    let record = centralOffset;
    for (const entry of entries) {
      expect(archive.readUInt32LE(record)).toBe(CENTRAL_SIGNATURE);
      const nameLength = archive.readUInt16LE(record + 28);
      const nameStart = record + CENTRAL_RECORD_SIZE;
      expect(archive.toString('utf8', nameStart, nameStart + nameLength)).toBe(entry.name);
      expect(archive.readUInt32LE(record + 42)).toBe(entry.offset);
      record = nameStart + nameLength;
    }

    expect(record + END_RECORD_SIZE).toBe(archive.length);
    expect(archive.readUInt32LE(record)).toBe(END_SIGNATURE);
    expect(archive.readUInt16LE(record + 8)).toBe(2);
    expect(archive.readUInt16LE(record + 10)).toBe(2);
    expect(archive.readUInt32LE(record + 12)).toBe(record - centralOffset);
    expect(archive.readUInt32LE(record + 16)).toBe(centralOffset);
  });
});
