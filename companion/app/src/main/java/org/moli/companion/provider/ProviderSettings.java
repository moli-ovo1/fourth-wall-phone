package org.moli.companion.provider;

import android.content.Context;
import android.content.SharedPreferences;
import org.moli.companion.security.CredentialVault;

/** Non-secret provider metadata + secret key stored separately in CredentialVault. */
public final class ProviderSettings {
    private static final String STORE = "moli_companion_provider_v1";
    private static final String KEY_ID = "ai:openai-compatible";
    private final SharedPreferences prefs;
    private final CredentialVault vault;
    public ProviderSettings(Context context) {
        prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
        vault = new CredentialVault(context);
    }
    public String baseUrl() { return prefs.getString("base_url", "https://api.openai.com/v1"); }
    public String model() { return prefs.getString("model", ""); }
    public boolean configured() {
        try { return !model().trim().isEmpty() && vault.get(KEY_ID) != null && !vault.get(KEY_ID).trim().isEmpty(); }
        catch (Exception e) { return false; }
    }
    public String apiKey() throws Exception { return vault.get(KEY_ID); }
    public void save(String baseUrl, String model, String apiKey) throws Exception {
        String base = baseUrl == null ? "" : baseUrl.trim();
        String m = model == null ? "" : model.trim();
        if (base.isEmpty() || m.isEmpty()) throw new IllegalArgumentException("Base URL 和模型不能为空");
        prefs.edit().putString("base_url", base.replaceAll("/+$", "")).putString("model", m).commit();
        if (apiKey != null && !apiKey.trim().isEmpty()) vault.put(KEY_ID, apiKey.trim());
    }
}
