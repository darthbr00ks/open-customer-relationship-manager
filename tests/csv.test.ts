import { describe, expect, it } from 'vitest';

import { parseCsv, parseCsvRecords } from '@/lib/csv';

describe('parseCsv', () => {
  it('reads plain rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('name,city\n"Acme, Inc.",Berlin')).toEqual([
      ['name', 'city'],
      ['Acme, Inc.', 'Berlin'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('name\n"She said ""hi"""')).toEqual([['name'], ['She said "hi"']]);
  });

  it('handles newlines inside quotes', () => {
    expect(parseCsv('notes\n"line one\nline two"')).toEqual([['notes'], ['line one\nline two']]);
  });

  it('treats CRLF as a single break', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops blank lines', () => {
    expect(parseCsv('a\n\n1\n')).toEqual([['a'], ['1']]);
  });
});

describe('parseCsvRecords', () => {
  it('keys rows by the header', () => {
    expect(parseCsvRecords('name,city\nAcme,Berlin')).toEqual([{ name: 'Acme', city: 'Berlin' }]);
  });

  it('fills missing trailing columns', () => {
    expect(parseCsvRecords('name,city\nAcme')).toEqual([{ name: 'Acme', city: '' }]);
  });

  it('returns nothing for empty input', () => {
    expect(parseCsvRecords('')).toEqual([]);
  });
});
