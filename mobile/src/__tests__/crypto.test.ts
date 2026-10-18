import { hmacSha256, sha256Hex, timingSafeEqual } from '../utils/crypto';
import crypto from 'crypto';

describe('Cryptographic Utilities (SEC-QR-001)', () => {
  test('sha256Hex produces identical digest to Node crypto', () => {
    const inputs = ['', 'test', 'BeltFlow V2.0', 'BF_PASS:2:bf_qr_k1:org_123:stu_456:1700000000:1702592000:nonce_abc'];
    for (const input of inputs) {
      const expected = crypto.createHash('sha256').update(input).digest('hex');
      const actual = sha256Hex(input);
      expect(actual).toBe(expected);
    }
  });

  test('hmacSha256 produces identical signature to Node crypto', () => {
    const testCases = [
      { key: 'test_key', data: 'test_data' },
      { key: 'bf_qr_secret_phase2_key_2026', data: 'BF_PASS:2:bf_qr_k1:org_persatuan_a:stu_a1:1700000000:1702592000:nonce_12345' },
      { key: 'a_very_long_key_that_exceeds_sixty_four_bytes_to_test_key_hashing_in_hmac_sha256_properly', data: 'arbitrary payload' },
    ];

    for (const { key, data } of testCases) {
      const expected = crypto.createHmac('sha256', key).update(data).digest('hex');
      const actual = hmacSha256(key, data);
      expect(actual).toBe(expected);
    }
  });

  test('timingSafeEqual correctly identifies equal and unequal strings in constant time', () => {
    const a = '46a5b27b7e6672271c998f4d79ed460ff03c88cacd31355ffc161539e1657824';
    const b = '46a5b27b7e6672271c998f4d79ed460ff03c88cacd31355ffc161539e1657824';
    const c = '46a5b27b7e6672271c998f4d79ed460ff03c88cacd31355ffc161539e1657825'; // 1 char different

    expect(timingSafeEqual(a, b)).toBe(true);
    expect(timingSafeEqual(a, c)).toBe(false);
    expect(timingSafeEqual(a, 'short')).toBe(false);
  });
});
