package buzz.aggames.lobby;

import android.animation.ObjectAnimator;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.widget.ProgressBar;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class SplashActivity extends AppCompatActivity {

    private static final long SPLASH_DURATION_MS = 1400L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable navigateRunnable = this::openLobby;
    private boolean navigated = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_splash);

        View root = findViewById(R.id.splash_root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            int pad = Math.round(24 * getResources().getDisplayMetrics().density);
            v.setPadding(pad + bars.left, pad + bars.top, pad + bars.right, pad + bars.bottom);
            return insets;
        });

        View brandContainer = findViewById(R.id.splash_brand_container);
        brandContainer.setAlpha(0f);
        brandContainer.setTranslationY(24f);
        brandContainer.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(480L)
                .setInterpolator(new DecelerateInterpolator())
                .start();

        ProgressBar progressBar = findViewById(R.id.splash_progress);
        ObjectAnimator progressAnim = ObjectAnimator.ofInt(progressBar, "progress", 0, 100);
        progressAnim.setDuration(SPLASH_DURATION_MS);
        progressAnim.setInterpolator(new DecelerateInterpolator());
        progressAnim.start();

        mainHandler.postDelayed(navigateRunnable, SPLASH_DURATION_MS);
    }

    private void openLobby() {
        if (navigated || isFinishing() || isDestroyed()) {
            return;
        }
        navigated = true;
        Intent intent = new Intent(this, WebViewActivity.class);
        startActivity(intent);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(navigateRunnable);
        super.onDestroy();
    }
}
