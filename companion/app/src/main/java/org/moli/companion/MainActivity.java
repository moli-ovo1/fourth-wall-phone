package org.moli.companion;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.TextView;

/** Phase 1B shell only. No scheduler or autonomous wake is started here. */
public final class MainActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        TextView status = new TextView(this);
        status.setGravity(Gravity.CENTER);
        status.setPadding(48, 48, 48, 48);
        status.setText("moli Companion\n\nPhase 1B runtime shell ready\nNo background Wake is enabled yet.");
        setContentView(status);
    }
}
