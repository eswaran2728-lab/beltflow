import { sha256Hex, timingSafeEqual, hexToBytes, utf8Encode } from '../utils/crypto';
import nacl from 'tweetnacl';
import crypto from 'crypto';

describe('Cryptographic Utilities (SEC-QR-001)', () => {
  test('sha256Hex produces identical digest to Node crypto', () => {
    const inputs = ['', 'test', 'BeltFlow V2.0', 'BF_PASS:v=2:kid=bf_ed25519_k1:iss=beltflow-authority:aud=beltflow-attendance:oid=org_123:sid=stu_456:iat=1700000000:exp=1702592000:nonce=nonce_abc'];
    for (const input of inputs) {
      const expected = crypto.createHash('sha256').update(input).digest('hex');
      const actual = sha256Hex(input);
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

  test('hexToBytes and utf8Encode conversions are accurate and reversible', () => {
    const hex = '9be104dc180101c12e16df1ca611f72818268fa376522891b3513edcab53fd17';
    const bytes = hexToBytes(hex);
    expect(bytes.length).toBe(32);
    expect(Buffer.from(bytes).toString('hex')).toBe(hex);

    const str = 'BeltFlow Ed25519 Authority';
    const utf8 = utf8Encode(str);
    expect(Buffer.from(utf8).toString('utf8')).toBe(str);
  });

  test('Ed25519 detached signature verification with TweetNaCl (SEC-QR-001)', () => {
    // Generate server-side test keypair
    const keyPair = nacl.sign.keyPair();
    const publicKeyBytes = keyPair.publicKey;
    const secretKeyBytes = keyPair.secretKey;

    const message = 'BF_PASS:v=2:kid=bf_ed25519_k1:iss=beltflow-authority:aud=beltflow-attendance:oid=org_a:sid=stu_1:iat=1700000000:exp=1702592000:nonce=n1';
    const msgBytes = utf8Encode(message);

    // Server signs with secret key
    const sigBytes = nacl.sign.detached(msgBytes, secretKeyBytes);
    expect(sigBytes.length).toBe(64);

    // Client verifies offline with ONLY public key
    const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, publicKeyBytes);
    expect(isValid).toBe(true);

    // Tampered message fails verification
    const tamperedMessage = 'BF_PASS:v=2:kid=bf_ed25519_k1:iss=beltflow-authority:aud=beltflow-attendance:oid=org_a:sid=stu_FORGED:iat=1700000000:exp=1702592000:nonce=n1';
    const isTamperedValid = nacl.sign.detached.verify(utf8Encode(tamperedMessage), sigBytes, publicKeyBytes);
    expect(isTamperedValid).toBe(false);

    // Tampered signature fails verification
    const tamperedSig = new Uint8Array(sigBytes);
    tamperedSig[0] ^= 0xff;
    const isTamperedSigValid = nacl.sign.detached.verify(msgBytes, tamperedSig, publicKeyBytes);
    expect(isTamperedSigValid).toBe(false);

    // Verification fails with wrong public key
    const anotherKeyPair = nacl.sign.keyPair();
    const isWrongKeyValid = nacl.sign.detached.verify(msgBytes, sigBytes, anotherKeyPair.publicKey);
    expect(isWrongKeyValid).toBe(false);

    // Untrusted client with ONLY public key cannot sign a valid credential
    expect(() => {
      // Trying to sign with 32-byte public key throws or produces invalid signature
      nacl.sign.detached(msgBytes, publicKeyBytes);
    }).toThrow();
  });
});

