package org.moli.companion;

import android.app.Application;
import org.moli.companion.bridge.LocalBridgeServer;

/**
 * Process-wide owner for the loopback Bridge.
 *
 * The Web UI and Companion Activity are separate Android apps/tasks.  The
 * bridge therefore must not be tied to MainActivity.onDestroy(): Android may
 * destroy that Activity as soon as the user switches back to SillyTavern,
 * which used to make the otherwise healthy 127.0.0.1 bridge disappear before
 * Web could probe it.
 *
 * This is intentionally not a fake background daemon.  WorkManager remains
 * the offline Wake scheduler; this object only keeps the local hand-off
 * transport alive for as long as the Companion process itself exists.
 */
public final class CompanionApplication extends Application {
    private LocalBridgeServer bridge;
    private volatile boolean bridgeRunning;
    private volatile String bridgeError = "";

    @Override public void onCreate() {
        super.onCreate();
        bridge = new LocalBridgeServer(getApplicationContext());
        try {
            bridge.start();
            bridgeRunning = true;
        } catch (Exception error) {
            bridgeRunning = false;
            bridgeError = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
        }
    }

    public LocalBridgeServer bridge() { return bridge; }
    public boolean bridgeRunning() { return bridgeRunning; }
    public String bridgeError() { return bridgeError; }
}
