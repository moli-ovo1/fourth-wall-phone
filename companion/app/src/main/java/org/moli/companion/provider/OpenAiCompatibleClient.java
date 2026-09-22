package org.moli.companion.provider;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Minimal independent provider client for background execution. */
public final class OpenAiCompatibleClient {
    private final ProviderSettings settings;
    public OpenAiCompatibleClient(ProviderSettings settings) { this.settings = settings; }

    public String complete(String system, String user) throws Exception {
        if (!settings.configured()) throw new IllegalStateException("provider-not-configured");
        URL url = new URL(settings.baseUrl() + "/chat/completions");
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setRequestMethod("POST"); c.setConnectTimeout(20000); c.setReadTimeout(60000); c.setDoOutput(true);
        c.setRequestProperty("Authorization", "Bearer " + settings.apiKey());
        c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        JSONObject body = new JSONObject()
            .put("model", settings.model())
            .put("temperature", 0.8)
            .put("messages", new JSONArray()
                .put(new JSONObject().put("role", "system").put("content", system))
                .put(new JSONObject().put("role", "user").put("content", user)));
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream out = c.getOutputStream()) { out.write(bytes); }
        int code = c.getResponseCode();
        InputStream stream = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
        String text = read(stream);
        if (code < 200 || code >= 300) throw new IOException("provider-http-" + code + ":" + text.substring(0, Math.min(240, text.length())));
        JSONObject json = new JSONObject(text);
        JSONArray choices = json.optJSONArray("choices");
        if (choices == null || choices.length() == 0) throw new IOException("provider-empty-choices");
        String content = choices.getJSONObject(0).optJSONObject("message").optString("content", "").trim();
        if (content.isEmpty()) throw new IOException("provider-empty-content");
        return content;
    }
    private static String read(InputStream in) throws IOException {
        if (in == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
