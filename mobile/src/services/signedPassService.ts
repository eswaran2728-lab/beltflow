import * as SecureStore from 'expo-secure-store';
import { apiClient } from './apiClient';

/**
 * The attendance pass is signed by the server (Ed25519). The phone shows the
 * server's QR exactly as issued and never builds its own, because a Master's
 * scanner refuses any pass without a valid signature.
 *
 * The last signed pass is kept on the phone (secure storage) so it can still
 * be shown at roll-call without a connection until it expires. It holds no
 * personal details: only ids, dates and the signature.
 */
export interface SignedPass {
  qrString: string;
  issuedAt: string;
  expiresAt: string;
}

const memory = new Map<string, SignedPass>();
const INDEX_KEY = 'bf_pass_index';

async function remember(studentId: string): Promise<void> {
  try {
    const list: string[] = JSON.parse((await SecureStore.getItemAsync(INDEX_KEY)) || '[]');
    if (!list.includes(studentId)) await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify([...list, studentId].slice(-20)));
  } catch {
    // Storage is a convenience only.
  }
}
const storageKey = (studentId: string) => `bf_pass_${studentId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
const stillValid = (p: SignedPass | null | undefined): p is SignedPass =>
  !!p && typeof p.qrString === 'string' && new Date(p.expiresAt).getTime() > Date.now();

async function readStored(studentId: string): Promise<SignedPass | null> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(studentId));
    const parsed = raw ? (JSON.parse(raw) as SignedPass) : null;
    return stillValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const signedPassService = {
  /** A stored, unexpired pass for this student, if any (works offline). */
  async getCached(studentId: string): Promise<SignedPass | null> {
    const inMemory = memory.get(studentId);
    if (stillValid(inMemory)) return inMemory;
    const stored = await readStored(studentId);
    if (stored) memory.set(studentId, stored);
    return stored;
  },

  /** Ask the server for a freshly signed pass, and keep it for offline use. */
  async fetch(studentId: string): Promise<SignedPass> {
    const res = await apiClient.get<{ pass?: SignedPass }>(`/api/v1/students/${encodeURIComponent(studentId)}/digital-pass`);
    const pass = res?.pass;
    if (!pass || typeof pass.qrString !== 'string') throw new Error('The server did not return a pass.');
    const kept: SignedPass = { qrString: pass.qrString, issuedAt: pass.issuedAt, expiresAt: pass.expiresAt };
    memory.set(studentId, kept);
    SecureStore.setItemAsync(storageKey(studentId), JSON.stringify(kept)).then(() => remember(studentId), () => undefined);
    return kept;
  },

  /** Signing out removes every pass kept on this phone. */
  async forgetAll(): Promise<void> {
    memory.clear();
    try {
      const list: string[] = JSON.parse((await SecureStore.getItemAsync(INDEX_KEY)) || '[]');
      await Promise.all(list.map(id => SecureStore.deleteItemAsync(storageKey(id)).catch(() => undefined)));
      await SecureStore.deleteItemAsync(INDEX_KEY);
    } catch {
      // Nothing stored.
    }
  },
};
