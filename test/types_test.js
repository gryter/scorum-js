const Convert = require('../src/auth/serializer/src/convert');
const Long = require('bytebuffer').Long;

const assert = require('assert');
const type = require('../src/auth/serializer/src/types');
const p = require('../src/auth/serializer/src/precision');
const th = require('./test_helper');

describe('scorum.auth: types', () => {
  it('vote_id', () => {
    const toHex = function (id) {
      const vote = type.vote_id.fromObject(id);
      return Convert(type.vote_id).toHex(vote);
    };
    assert.equal('ff000000', toHex('255:0'));
    assert.equal('00ffffff', toHex(`0:${0xffffff}`));
    const out_of_range = function (id) {
      try {
        toHex(id);
        return assert(false, 'should have been out of range');
      } catch (e) {
        return assert(e.message.indexOf('out of range') !== -1);
      }
    };
    out_of_range(`0:${0xffffff + 1}`);
    out_of_range('256:0');
  });

  it('set sort', () => {
    const bool_set = type.set(type.bool);
    // Note, 1,0 sorts to 0,1
    assert.equal('020001', Convert(bool_set).toHex([1, 0]));
    th.error('duplicate (set)', () => Convert(bool_set).toHex([1, 1]));
  });

  it('string sort', () => {
    const setType = type.set(type.string);
    const set = setType.fromObject(['a', 'z', 'm']);
    const setObj = setType.toObject(set);
    assert.deepEqual(['a', 'm', 'z'], setObj, 'not sorted');
  });

  it('map sort', () => {
    const bool_map = type.map(type.bool, type.bool);
    // 1,1 0,0   sorts to   0,0  1,1
    assert.equal('0200000101', Convert(bool_map).toHex([[1, 1], [0, 0]]));
    th.error('duplicate (map)', () => Convert(bool_map).toHex([[1, 1], [1, 1]]));
  });

  it('public_key sort', () => {
    const mapType = type.map(type.public_key, type.uint16);
    const map = mapType.fromObject([
      // not sorted
      ['SCR8me6d9PqzTgcoHxx6b4rnvWVTqz11kafidRAZwfacJkcJtfd75', 0],
      ['SCR56ankGHKf6qUsQe7vPsXTSEqST6Dt1ff73aV3YQbedzRua8NLQ', 0]
    ]);
    const mapObject = mapType.toObject(map);
    assert.deepEqual(mapObject, [
      // sorted (uppercase comes first)
      ['SCR56ankGHKf6qUsQe7vPsXTSEqST6Dt1ff73aV3YQbedzRua8NLQ', 0],
      ['SCR8me6d9PqzTgcoHxx6b4rnvWVTqz11kafidRAZwfacJkcJtfd75', 0]
    ]);
  });

  it('type_id sort', () => {
    // map (protocol_id_type "account"), (uint16)
    const t = type.map(type.protocol_id_type('account'), type.uint16);
    assert.deepEqual(t.fromObject([[1, 1], [0, 0]]), [[0, 0], [1, 1]], 'did not sort');
    assert.deepEqual(t.fromObject([[0, 0], [1, 1]]), [[0, 0], [1, 1]], 'did not sort');
  });

  it('precision number strings', () => {
    const check = function (input_string, precision, output_string) {
      return assert.equal(output_string, p._internal.decimal_precision_string(input_string, precision));
    };

    check('12345678901234567890123456789012345678901234567890.12345', 5, '1234567890123456789012345678901234567890123456789012345');
    check('', 0, '0');
    check('0', 0, '0');
    check('-0', 0, '0');
    check('-00', 0, '0');
    check('-0.0', 0, '0');
    check('-', 0, '0');
    check('1', 0, '1');
    check('11', 0, '11');

    overflow(() => check('.1', 0, ''));
    overflow(() => check('-.1', 0, ''));
    overflow(() => check('0.1', 0, ''));
    overflow(() => check('1.1', 0, ''));
    overflow(() => check('1.11', 1, ''));

    check('', 1, '00');
    check('1', 1, '10');
    check('1.1', 1, '11');
    check('-1', 1, '-10');
    check('-1.1', 1, '-11');
  });

  return it('precision number long', () => {
    let _precision;
    assert.equal(
      Long.MAX_VALUE.toString(),
      p.to_bigint64(Long.MAX_VALUE.toString(), (_precision = 0)).toString(),
      'to_bigint64 MAX_VALUE mismatch'
    );

    // Long.MAX_VALUE.toString() == 9223372036854775807
    // Long.MAX_VALUE.toString() +1 9223372036854775808
    overflow(() => p.to_bigint64('9223372036854775808', (_precision = 0)));

    assert.equal('0', p.to_string64(Long.ZERO, 0));
    assert.equal('00', p.to_string64(Long.ZERO, 1));

    overflow(() => p.to_bigint64('92233720368547758075', (_precision = 1)));
  });
});

var overflow = function (f) {
  return th.error('overflow', f);
};
