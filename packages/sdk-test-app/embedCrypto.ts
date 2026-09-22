import {
    createCipheriv,
    createDecipheriv,
    pbkdf2Sync,
    randomBytes,
} from 'crypto';

// Mirrors the backend's EncryptionUtil, so dev tooling can read the embed secret.
export function encrypt(message: string, secret: string): Buffer {
    const saltLength = 64;
    const ivLength = 12;
    const authTagLength = 16;
    const iv = randomBytes(ivLength);
    const salt = randomBytes(saltLength);
    const key = pbkdf2Sync(secret, salt, 2000, 32, 'sha512');
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength });
    const encrypted = Buffer.concat([
        cipher.update(message, 'utf-8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, tag, iv, encrypted]);
}

export function decrypt(encrypted: Buffer, secret: string): string {
    const saltLength = 64;
    const authTagLength = 16;
    const ivLength = 12;
    const salt = encrypted.slice(0, saltLength);
    const tag = encrypted.slice(saltLength, saltLength + authTagLength);
    const iv = encrypted.slice(
        saltLength + authTagLength,
        saltLength + authTagLength + ivLength,
    );
    const encryptedMessage = encrypted.slice(
        saltLength + authTagLength + ivLength,
    );
    const key = pbkdf2Sync(secret, salt, 2000, 32, 'sha512');
    const decipher = createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength,
    });
    decipher.setAuthTag(tag);
    return `${decipher.update(encryptedMessage, undefined, 'utf-8')}${decipher.final()}`;
}
