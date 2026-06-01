import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailValidationInput {
  to_addresses: unknown;
  cc_addresses?: unknown;
  subject: unknown;
  body: unknown;
}

export interface EmailValidationResult {
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  body: string;
}

function normalizeEmailList(value: unknown): string[] {
  if (!value) return [];
  const rawValues = Array.isArray(value) ? value : String(value).split(',');
  return rawValues
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function validateOptionalEmailList(value: unknown, label: string): string[] {
  const emails = normalizeEmailList(value);
  const invalid = emails.find((email) => !EMAIL_REGEX.test(email));
  if (invalid) {
    throw new Error(`One or more ${label} email addresses are invalid: ${invalid}`);
  }

  const seen = new Set<string>();
  const duplicate = emails.find((email) => {
    if (seen.has(email)) return true;
    seen.add(email);
    return false;
  });
  if (duplicate) {
    throw new Error(`Duplicate ${label} email address found: ${duplicate}`);
  }

  return emails;
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'span', 'u']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['style'],
      div: ['style'],
      p: ['style'],
      hr: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  });
}

function textFromHtml(html: string): string {
  return html
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function validateEmailPayload(input: EmailValidationInput): EmailValidationResult {
  const toAddresses = normalizeEmailList(input.to_addresses);
  const ccAddresses = normalizeEmailList(input.cc_addresses);
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const rawBody = typeof input.body === 'string' ? input.body : '';
  const body = sanitizeRichText(rawBody);

  if (toAddresses.length === 0) {
    throw new Error('Please enter at least one valid TO email address.');
  }

  const invalid = [...toAddresses, ...ccAddresses].find((email) => !EMAIL_REGEX.test(email));
  if (invalid) {
    throw new Error(`One or more email addresses are invalid: ${invalid}`);
  }

  const toSeen = new Set<string>();
  const duplicateTo = toAddresses.find((email) => {
    if (toSeen.has(email)) return true;
    toSeen.add(email);
    return false;
  });
  if (duplicateTo) {
    throw new Error(`Duplicate TO email address found: ${duplicateTo}`);
  }

  const ccSeen = new Set<string>();
  const duplicateCc = ccAddresses.find((email) => {
    if (ccSeen.has(email)) return true;
    ccSeen.add(email);
    return false;
  });
  if (duplicateCc) {
    throw new Error(`Duplicate CC email address found: ${duplicateCc}`);
  }

  const toSet = new Set(toAddresses);
  const overlap = ccAddresses.find((email) => toSet.has(email));
  if (overlap) {
    throw new Error(`The same email address cannot be added in both TO and CC: ${overlap}`);
  }

  if (!subject) {
    throw new Error('Subject is required.');
  }

  if (!textFromHtml(body)) {
    throw new Error('Email body is required.');
  }

  return { toAddresses, ccAddresses, subject, body };
}

export function toObjectIds(ids: unknown): mongoose.Types.ObjectId[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      throw new Error('Invalid attachment ID.');
    }
    return new mongoose.Types.ObjectId(String(id));
  });
}
