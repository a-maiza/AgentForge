from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def decrypt_api_key(encrypted: str, hex_key: str) -> str:
    """Decrypt AES-256-GCM encrypted API key from NestJS EncryptionService.

    Format: "{iv_hex}:{auth_tag_hex}:{ciphertext_hex}"
    IV = 12 bytes, auth tag = 16 bytes, all hex-encoded, colon-separated.
    """
    parts = encrypted.split(":")
    if len(parts) != 3:
        raise ValueError(
            f"Invalid encrypted key format: expected 3 colon-separated parts, got {len(parts)}"
        )

    iv_hex, auth_tag_hex, ciphertext_hex = parts
    iv = bytes.fromhex(iv_hex)
    auth_tag = bytes.fromhex(auth_tag_hex)
    ciphertext = bytes.fromhex(ciphertext_hex)
    key = bytes.fromhex(hex_key)

    # AESGCM expects ciphertext + auth_tag concatenated
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
    return plaintext.decode("utf-8")
