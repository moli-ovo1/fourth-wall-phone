package org.moli.companion;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import org.moli.companion.bridge.LocalBridgeServer;

/** Owns the loopback HTTP bridge while Android keeps a visible foreground service alive. */
public final class BridgeForegroundService extends Service {
    private static final String ACTION_RESTART = "org.moli.companion.RESTART_BRIDGE";
    private static final String CHANNEL_ID = "moli_companion_bridge";
    private static final int NOTIFICATION_ID = 17463;
    private static volatile boolean running;
    private static volatile String error = "";
    private LocalBridgeServer bridge;

    public static void start(Context context) {
        Intent intent = new Intent(context, BridgeForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
        else context.startService(intent);
    }

    public static void restart(Context context) {
        Intent intent = new Intent(context, BridgeForegroundService.class).setAction(ACTION_RESTART);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
        else context.startService(intent);
    }

    public static boolean bridgeRunning() { return running; }
    public static String bridgeError() { return error; }

    @Override public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, notification("正在启动本机 Bridge…"));
        startBridge();
    }

    private synchronized void startBridge() {
        if (bridge != null) bridge.stop();
        bridge = new LocalBridgeServer(getApplicationContext());
        try {
            bridge.start();
            running = false; error = "正在执行本机回环自检";
            new Thread(() -> {
                boolean healthy = false;
                for (int attempt=0;attempt<5&&!healthy;attempt++) { healthy=bridge!=null&&bridge.healthCheck();if(!healthy)try{Thread.sleep(150);}catch(InterruptedException ignored){Thread.currentThread().interrupt();} }
                running=healthy;error=healthy?"":"本机回环自检失败：端口已绑定但 health 无响应";
                NotificationManager manager=getSystemService(NotificationManager.class);
                manager.notify(NOTIFICATION_ID,notification(healthy?"本机 Bridge 已通过自检 · 127.0.0.1:17463":"Bridge 自检失败，请打开 App 后点刷新诊断"));
            },"moli-bridge-self-check").start();
        } catch (Exception failure) {
            running = false;
            error = failure.getMessage() == null ? failure.getClass().getSimpleName() : failure.getMessage();
            stopSelf();
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_RESTART.equals(intent.getAction())) new Thread(this::startBridge,"moli-bridge-restart").start();
        return START_STICKY;
    }

    @Override public void onDestroy() {
        running = false;
        if (bridge != null) bridge.stop();
        bridge = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "moli Companion Bridge",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("保持 SillyTavern 与本机 Companion 的连接");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification notification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle("moli Companion")
            .setContentText(text)
            .setContentIntent(pending)
            .setOngoing(true)
            .build();
    }
}
