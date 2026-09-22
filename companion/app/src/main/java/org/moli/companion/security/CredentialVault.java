package org.moli.companion.security;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Secret-only vault. Wake Snapshot/Journal must never contain these values. */
public final class CredentialVault {
    private static final String STORE = "moli_companion_credentials_v1";
    private static final String ALIAS = "moli_companion_aes_v1";
    private final SharedPreferences prefs;

    public CredentialVault(Context context) { prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE); }

    public void put(String id, String secret) throws Exception {
        if (id == null || id.trim().isEmpty()) throw new IllegalArgumentException("credential id required");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] ciphertext = cipher.doFinal((secret == null ? "" : secret).getBytes(StandardCharsets.UTF_8));
        String packed = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(ciphertext, Base64.NO_WRAP);
        prefs.edit().putString(id, packed).apply();
    }

    public String get(String id) throws Exception {
        String packed = prefs.getString(id, null);
        if (packed == null) return null;
        String[] parts = packed.split("\\.", 2);
        if (parts.length != 2) throw new IllegalStateException("corrupt credential");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    public void remove(String id) { prefs.edit().remove(id).apply(); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
}
