/**
 * Client-side encryption utilities using WebCrypto API
 * All encryption happens in the browser - server never sees plaintext data
 * 
 * Algorithms:
 * - AES-256-GCM for symmetric encryption (file payloads)
 * - RSA-OAEP-4096 for asymmetric encryption (key wrapping)
 * - PBKDF2 for key derivation from passphrases
 */

// Convert ArrayBuffer to base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate RSA-OAEP keypair for user
 * Private key must be encrypted with user's passphrase before storing
 */
export async function generateUserKeypair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );

  return keyPair;
}

/**
 * Export public key to base64 string
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Export private key to base64 string
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import public key from base64 string
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'wrapKey']
  );
}

/**
 * Import private key from base64 string
 */
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt', 'unwrapKey']
  );
}

/**
 * Derive encryption key from passphrase using PBKDF2
 * Used to encrypt the user's private key
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // High iteration count for security
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt private key with passphrase-derived key
 */
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  passphrase: string
): Promise<{ encryptedKey: string; salt: string; iv: string }> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from passphrase
  const derivedKey = await deriveKeyFromPassphrase(passphrase, salt);

  // Export private key
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', privateKey);

  // Encrypt private key
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    derivedKey,
    privateKeyBuffer
  );

  return {
    encryptedKey: arrayBufferToBase64(encryptedBuffer),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt private key with passphrase
 */
export async function decryptPrivateKey(
  encryptedKey: string,
  salt: string,
  iv: string,
  passphrase: string
): Promise<CryptoKey> {
  const saltBuffer = base64ToArrayBuffer(salt);
  const ivBuffer = base64ToArrayBuffer(iv);
  const encryptedBuffer = base64ToArrayBuffer(encryptedKey);

  // Derive key from passphrase
  const derivedKey = await deriveKeyFromPassphrase(
    passphrase,
    new Uint8Array(saltBuffer)
  );

  // Decrypt private key
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    derivedKey,
    encryptedBuffer
  );

  // Import decrypted private key
  return await crypto.subtle.importKey(
    'pkcs8',
    decryptedBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt', 'unwrapKey']
  );
}

/**
 * Generate random AES-256-GCM key for file encryption
 */
export async function generateFileEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt file using AES-256-GCM
 */
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{ encrypted: Blob; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    fileBuffer
  );

  return {
    encrypted: new Blob([encryptedBuffer]),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt file using AES-256-GCM
 */
export async function decryptFile(
  encryptedBlob: Blob,
  key: CryptoKey,
  iv: string
): Promise<Blob> {
  const encryptedBuffer = await encryptedBlob.arrayBuffer();
  const ivBuffer = base64ToArrayBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    key,
    encryptedBuffer
  );

  return new Blob([decryptedBuffer]);
}

/**
 * Wrap (encrypt) symmetric key with public key
 * Used for sharing files between users
 */
export async function wrapSymmetricKey(
  symmetricKey: CryptoKey,
  publicKey: CryptoKey
): Promise<string> {
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    symmetricKey,
    publicKey,
    { name: 'RSA-OAEP' }
  );

  return arrayBufferToBase64(wrappedKey);
}

/**
 * Unwrap (decrypt) symmetric key with private key
 */
export async function unwrapSymmetricKey(
  wrappedKey: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedKeyBuffer = base64ToArrayBuffer(wrappedKey);

  return await crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBuffer,
    privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Calculate SHA-256 checksum of file
 */
export async function calculateFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Generate secure random passphrase
 * For AI assistant to suggest
 */
export function generateSecurePassphrase(wordCount: number = 6): string {
  const wordList = [
    'correct', 'horse', 'battery', 'staple', 'quantum', 'cipher',
    'secure', 'encrypt', 'shield', 'vault', 'fortress', 'guardian',
    'phoenix', 'thunder', 'shadow', 'crystal', 'dragon', 'forest',
    'mountain', 'river', 'sunset', 'ocean', 'galaxy', 'cosmos',
  ];
  
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % wordList.length;
    words.push(wordList[randomIndex]);
  }
  
  return words.join('-');
}
