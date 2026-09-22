package org.moli.companion;

import android.app.Activity;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.widget.*;
import org.moli.companion.bridge.LocalBridgeServer;
import org.moli.companion.bridge.BridgeStore;
import org.moli.companion.provider.ProviderSettings;
import org.moli.companion.wake.CompanionWakeScheduler;

/** Foreground shell: loopback bridge + independent background provider configuration. */
public final class MainActivity extends Activity {
    private LocalBridgeServer bridge;
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        CompanionWakeScheduler.ensureScheduled(getApplicationContext());
        BridgeStore store = new BridgeStore(getApplicationContext());
        ProviderSettings provider = new ProviderSettings(getApplicationContext());
        bridge = new LocalBridgeServer(getApplicationContext());

        LinearLayout box = new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL); box.setPadding(48,48,48,48);
        TextView status = new TextView(this); status.setGravity(Gravity.CENTER_HORIZONTAL);
        try { bridge.start(); status.setText("moli Companion\n\n本机 Bridge 已启动 · 17463\n\n配对码：\n" + bridge.pairingToken() + "\n\n后台调度：已启用（约每 15 分钟一次机会）\n最近 Worker：" + store.getWorkerSummary()); }
        catch (Exception error) { status.setText("moli Companion\n\nBridge 启动失败：\n" + error.getMessage()); }
        box.addView(status);

        TextView title = new TextView(this); title.setText("\n后台 AI Provider（OpenAI-compatible）"); box.addView(title);
        EditText base = new EditText(this); base.setHint("Base URL，例如 https://api.openai.com/v1"); base.setText(provider.baseUrl()); box.addView(base);
        EditText model = new EditText(this); model.setHint("模型 ID"); model.setText(provider.model()); box.addView(model);
        EditText key = new EditText(this); key.setHint(provider.configured() ? "API Key（已保存；留空保持原值）" : "API Key"); key.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); box.addView(key);
        Button save = new Button(this); save.setText("保存后台 Provider"); box.addView(save);
        TextView providerState = new TextView(this); providerState.setText(provider.configured() ? "状态：已配置，可供后台 Wake 使用" : "状态：未配置；后台 Worker 不会调用 AI"); box.addView(providerState);
        save.setOnClickListener(v -> { try { provider.save(base.getText().toString(), model.getText().toString(), key.getText().toString()); key.setText(""); providerState.setText("状态：已保存。API Key 仅进入 Android Credential Vault，不进入 Wake Snapshot/Journal。"); } catch(Exception e) { providerState.setText("保存失败：" + e.getMessage()); } });

        ScrollView scroll = new ScrollView(this); scroll.addView(box); setContentView(scroll);
    }
    @Override protected void onDestroy() { if (bridge != null) bridge.stop(); super.onDestroy(); }
}
