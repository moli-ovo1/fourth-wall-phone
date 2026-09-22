package org.moli.companion.diagnostics;

import android.content.Context;
import org.json.JSONObject;
import org.moli.companion.bridge.BridgeStore;
import org.moli.companion.mcp.McpProfileStore;
import org.moli.companion.provider.ProviderSettings;
import java.util.List;

/** Read-only field report for first real-device acceptance. Never prints credentials or endpoint secrets. */
public final class CompanionDiagnostics {
    private CompanionDiagnostics() {}
    public static String render(Context context, boolean bridgeRunning) {
        BridgeStore store = new BridgeStore(context); ProviderSettings provider = new ProviderSettings(context);
        McpProfileStore mcp = new McpProfileStore(context); List<String> scopes = store.listWakeScopes();
        StringBuilder out = new StringBuilder();
        out.append("Bridge：").append(bridgeRunning ? "运行中" : "未运行");
        out.append("\n后台 Provider：").append(provider.configured() ? "已配置" : "未配置");
        out.append("\n已同步角色 Scope：").append(scopes.size());
        out.append("\n最近 Worker 汇总：").append(store.getWorkerSummary());
        out.append("\n最近 Worker 时间：").append(store.getWorkerSummaryAt() <= 0 ? "尚未运行" : store.getWorkerSummaryAt());
        for (String scope : scopes) {
            JSONObject request = store.getWakeRequest(scope); String actor = request.optString("characterId", "");
            String name = request.optString("actorName", actor.isEmpty() ? "未知角色" : actor);
            out.append("\n\n• ").append(name);
            out.append("\n  scope: ").append(scope);
            out.append("\n  MCP: ").append(mcp.configured(actor) ? "已配置" : "未配置/未授权");
            out.append("\n  Worker: ").append(store.getWorkerStatus(scope));
            out.append("\n  待回收结果: ").append(store.getPendingWakeResultCount(scope));
        }
        out.append("\n\n说明：诊断页不会显示 API Key、MCP Endpoint、Bearer 或自定义 Header。配对码仅在上方单独显示。\n");
        out.append("当前 Bridge 生命周期仍跟随 Companion 前台界面；这是首轮真机测试前已知限制，不把它伪装成后台常驻服务。");
        return out.toString();
    }
}
