import crypto from 'crypto';
import type { Request } from 'express';
import { dbClient } from '../db/client';
import { LEGAL_DOCUMENTS_VERSION } from '../config/legal';
import { clientHash } from './securityEvents';

/**
 * Consent records (PDPA Notice and Choice): who agreed to what, to which
 * version of the documents, and when. Rows are only ever added.
 */
export type ConsentType =
  | 'PRIVACY_NOTICE'    // has read the privacy notice
  | 'TERMS'             // agrees to the terms and conditions
  | 'GUARDIAN'          // parent/guardian consents to the child's data being processed
  | 'AGE_OR_GUARDIAN';  // student is 18 or older, or a parent/guardian has agreed

/** Only a real boolean true counts: no "yes", no 1, no pre-filled value. */
export function agreed(value: unknown): boolean {
  return value === true;
}

export async function recordConsents(userId: string, types: ConsentType[], req?: Request): Promise<void> {
  for (const type of types) {
    await dbClient.query(
      `INSERT INTO user_consents (id, user_id, consent_type, document_version, client_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [`con_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`, userId, type, LEGAL_DOCUMENTS_VERSION, clientHash(req)]
    );
  }
}
