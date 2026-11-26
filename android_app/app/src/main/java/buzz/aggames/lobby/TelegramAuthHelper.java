package buzz.aggames.lobby;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class TelegramAuthHelper {

    public interface Callback {
        void onSuccess(@NonNull JSONObject data);
        void onError(@NonNull String code, @NonNull String message);
    }

    public static final String REDIRECT_HOST = "app3383447084-login.tg.dev";
    public static final String REDIRECT_URI = "https://" + REDIRECT_HOST + "/tglogin";
    private static final String BASE_URL = "https://oauth.telegram.org";

    private static final ExecutorService IO_EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());

    private static volatile String activeCodeVerifier;
    private static volatile Callback activeCallback;

    private TelegramAuthHelper() {
    }

    public static void signIn(@NonNull Activity activity, @NonNull String clientId, @NonNull Callback callback) {
        if (TextUtils.isEmpty(clientId)) {
            callback.onError("TELEGRAM_NOT_CONFIGURED", "TELEGRAM_BOT_ID is not configured");
            return;
        }

        String verifier = generateCodeVerifier();
        String challenge = generateCodeChallenge(verifier);
        activeCodeVerifier = verifier;
        activeCallback = callback;

        IO_EXECUTOR.execute(() -> {
            String tgUrl = fetchCrossAppUrl(clientId, challenge);
            MAIN_HANDLER.post(() -> {
                if (activity.isFinishing() || activity.isDestroyed()) {
                    return;
                }
                if (!TextUtils.isEmpty(tgUrl) && tryOpenUrl(activity, tgUrl)) {
                    return;
                }
                String webUrl = Uri.parse(BASE_URL + "/auth")
                        .buildUpon()
                        .appendQueryParameter("client_id", clientId)
                        .appendQueryParameter("response_type", "code")
                        .appendQueryParameter("scope", "openid profile")
                        .appendQueryParameter("redirect_uri", REDIRECT_URI)
                        .appendQueryParameter("code_challenge", challenge)
                        .appendQueryParameter("code_challenge_method", "S256")
                        .build()
                        .toString();
                if (!tryOpenUrl(activity, webUrl)) {
                    Callback cb = activeCallback;
                    activeCallback = null;
                    activeCodeVerifier = null;
                    if (cb != null) {
                        cb.onError("TELEGRAM_OPEN_FAILED", "Unable to open Telegram or browser");
                    }
                }
            });
        });
    }

    public static boolean handleRedirectIntent(@Nullable Intent intent) {
        if (intent == null) {
            return false;
        }
        Uri uri = intent.getData();
        if (uri == null || !REDIRECT_HOST.equalsIgnoreCase(uri.getHost())) {
            return false;
        }

        Callback cb = activeCallback;
        String verifier = activeCodeVerifier;
        activeCallback = null;
        activeCodeVerifier = null;

        if (cb == null) {
            return true;
        }

        String error = uri.getQueryParameter("error");
        if (!TextUtils.isEmpty(error)) {
            String desc = uri.getQueryParameter("error_description");
            cb.onError("TELEGRAM_AUTH_ERROR", !TextUtils.isEmpty(desc) ? desc : error);
            return true;
        }

        String code = uri.getQueryParameter("code");
        if (TextUtils.isEmpty(code) || TextUtils.isEmpty(verifier)) {
            cb.onError("TELEGRAM_NO_CODE", "No authorization code in Telegram callback");
            return true;
        }

        try {
            JSONObject data = new JSONObject();
            data.put("code", code);
            data.put("redirectUri", REDIRECT_URI);
            data.put("codeVerifier", verifier);
            cb.onSuccess(data);
        } catch (Exception e) {
            cb.onError("TELEGRAM_INTERNAL_ERROR", "Failed to build Telegram callback payload");
        }
        return true;
    }

    @Nullable
    private static String fetchCrossAppUrl(@NonNull String clientId, @NonNull String codeChallenge) {
        HttpURLConnection conn = null;
        try {
            String urlStr = Uri.parse(BASE_URL + "/crossapp")
                    .buildUpon()
                    .appendQueryParameter("client_id", clientId)
                    .appendQueryParameter("response_type", "code")
                    .appendQueryParameter("scope", "openid profile")
                    .appendQueryParameter("redirect_uri", REDIRECT_URI)
                    .appendQueryParameter("android_sdk", "1")
                    .appendQueryParameter("code_challenge", codeChallenge)
                    .appendQueryParameter("code_challenge_method", "S256")
                    .build()
                    .toString();

            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Accept", "application/json");

            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return null;
            }
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
            JSONObject json = new JSONObject(sb.toString());
            String tgUrl = json.optString("url", "");
            if (TextUtils.isEmpty(tgUrl)) {
                tgUrl = json.optString("tg_url", "");
            }
            return TextUtils.isEmpty(tgUrl) ? null : tgUrl;
        } catch (Exception ignored) {
            return null;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static boolean tryOpenUrl(@NonNull Activity activity, @NonNull String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            activity.startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String generateCodeVerifier() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private static String generateCodeChallenge(@NonNull String verifier) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.encodeToString(digest, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        } catch (Exception e) {
            return verifier;
        }
    }
}
