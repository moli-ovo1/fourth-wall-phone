package org.moli.companion;

import android.app.Activity;
import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.widget.*;
import org.moli.companion.bridge.BridgeStore;
import org.moli.companion.diagnostics.CompanionDiagnostics;
import org.moli.companion.provider.ProviderSettings;
import org.moli.companion.wake.CompanionWakeScheduler;

/** Foreground setup + diagnostics shell. Canonical character state remains in moli Web. */
public final class MainActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestNotificationPermission();
        BridgeForegroundService.start(this);
        CompanionWakeScheduler.ensureScheduled(getApplicationContext());
        BridgeStore store = new BridgeStore(getApplicationContext());
        ProviderSettings provider = new ProviderSettings(getApplicationContext());

        LinearLayout box = new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL); box.setPadding(48,48,48,48);
        TextView status = new TextView(this); status.setGravity(Gravity.CENTER_HORIZONTAL);
        Runnable refreshBridgeStatus = () -> {
            if (BridgeForegroundService.bridgeRunning()) status.setText("moli Companion 0.2.1\n\n本机 Bridge 已通过 health 自检 · 17463\n\n配对码：\n" + store.pairingToken() + "\n\n后台调度：已启用（约每 15 分钟一次机会）");
            else status.setText("moli Companion 0.2.1\n\nBridge 未通过自检：\n" + BridgeForegroundService.bridgeError() + "\n\n配对码：\n" + store.pairingToken());
        };
        refreshBridgeStatus.run();
        status.postDelayed(refreshBridgeStatus, 500);
        box.addView(status);
        Button copyPairingCode = new Button(this); copyPairingCode.setText("复制配对码");
        copyPairingCode.setOnClickListener(v -> {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            clipboard.setPrimaryClip(ClipData.newPlainText("moli Companion 配对码", store.pairingToken()));
            Toast.makeText(this, "配对码已复制", Toast.LENGTH_SHORT).show();
        });
        box.addView(copyPairingCode);

        TextView title = new TextView(this); title.setText("\n后台 AI Provider（OpenAI-compatible）"); box.addView(title);
        EditText base = new EditText(this); base.setHint("Base URL，例如 https://api.openai.com/v1"); base.setText(provider.baseUrl()); box.addView(base);
        EditText model = new EditText(this); model.setHint("模型 ID"); model.setText(provider.model()); box.addView(model);
        EditText key = new EditText(this); key.setHint(provider.configured() ? "API Key（已保存；留空保持原值）" : "API Key"); key.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); box.addView(key);
        Button save = new Button(this); save.setText("保存后台 Provider"); box.addView(save);
        TextView providerState = new TextView(this); providerState.setText(provider.configured() ? "状态：已配置，可供后台 Wake 使用" : "状态：未配置；后台 Worker 不会调用 AI"); box.addView(providerState);
        save.setOnClickListener(v -> { try { provider.save(base.getText().toString(), model.getText().toString(), key.getText().toString()); key.setText(""); providerState.setText("状态：已保存。API Key 仅进入 Android Credential Vault。"); } catch(Exception e) { providerState.setText("保存失败：" + e.getMessage()); } });

        TextView diagTitle = new TextView(this); diagTitle.setText("\n真机诊断"); box.addView(diagTitle);
        TextView diagnostics = new TextView(this); box.addView(diagnostics);
        Runnable refresh = () -> diagnostics.setText(CompanionDiagnostics.render(getApplicationContext(), BridgeForegroundService.bridgeRunning()));
        Button refreshButton = new Button(this); refreshButton.setText("重启 Bridge 并刷新诊断"); refreshButton.setOnClickListener(v -> { BridgeForegroundService.restart(this); status.postDelayed(refreshBridgeStatus, 1200); status.postDelayed(refresh, 1200); }); box.addView(refreshButton);
        Button runNow = new Button(this); runNow.setText("请求一次后台 Wake 测试"); runNow.setOnClickListener(v -> { CompanionWakeScheduler.runDiagnosticNow(getApplicationContext()); Toast.makeText(this,"已交给 WorkManager；稍后点“刷新诊断”查看结果",Toast.LENGTH_LONG).show(); }); box.addView(runNow);
        refresh.run();

        ScrollView scroll = new ScrollView(this); scroll.addView(box); setContentView(scroll);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 17463);
        }
    }
}
