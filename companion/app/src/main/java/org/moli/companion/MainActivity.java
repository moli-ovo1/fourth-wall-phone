package org.moli.companion;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.TextView;
import org.moli.companion.bridge.LocalBridgeServer;
import org.moli.companion.bridge.BridgeStore;
import org.moli.companion.wake.CompanionWakeScheduler;

/** Foreground shell + loopback bridge. Background scheduling is intentionally not enabled yet. */
public final class MainActivity extends Activity {
    private LocalBridgeServer bridge;
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        TextView status = new TextView(this); status.setGravity(Gravity.CENTER); status.setPadding(48,48,48,48);
        bridge = new LocalBridgeServer(getApplicationContext());
        CompanionWakeScheduler.ensureScheduled(getApplicationContext());
        try {
            bridge.start();
            BridgeStore store = new BridgeStore(getApplicationContext());
            status.setText("moli Companion\n\n本机 Bridge 已启动\n端口: 17463\n\n配对码：\n" + bridge.pairingToken() + "\n\n把配对码填入 moli → MCP 中心 → Android Companion。\n\n后台调度：已启用（Android 约每 15 分钟提供一次机会）\n后台执行：等待 Headless capability runtime\n最近 Worker：" + store.getWorkerSummary());
        } catch (Exception error) { status.setText("moli Companion\n\nBridge 启动失败：\n" + error.getMessage()); }
        setContentView(status);
    }
    @Override protected void onDestroy() { if (bridge != null) bridge.stop(); super.onDestroy(); }
}
