package buzz.aggames.lobby;

import android.app.Activity;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import org.json.JSONObject;

public class AggamesBridge {

    public static final String JS_INTERFACE_NAME = "AggamesBridge";

    private final Activity activity;
    private final WebView webView;
    private final String appName;
    private final String cv;

    public AggamesBridge(@NonNull Activity activity, @NonNull WebView webView, @NonNull String appName, @NonNull String cv) {
        this.activity = activity;
        this.webView = webView;
        this.appName = appName;
        this.cv = cv;
    }

    @JavascriptInterface
    public void postMessage(String payloadJson) {
        if (TextUtils.isEmpty(payloadJson)) {
            return;
        }
        String requestId = "";
        String action;
        JSONObject params;
        try {
            JSONObject payload = new JSONObject(payloadJson);
            requestId = payload.optString("id", "");
            action = payload.optString("action", "");
            params = payload.optJSONObject("params");
            if (params == null) {
                params = new JSONObject();
            }
        } catch (Exception e) {
            return;
        }

        final String finalRequestId = requestId;
        final String finalAction = action;
        final JSONObject finalParams = params;

        activity.runOnUiThread(() -> dispatch(finalRequestId, finalAction, finalParams));
    }

    private void dispatch(@NonNull String requestId, @NonNull String action, @NonNull JSONObject params) {
        switch (action) {
            case "app.getInfo":
                handleGetInfo(requestId);
                break;
            case "auth.googleLogin":
                handleGoogleLogin(requestId, params);
                break;
            case "auth.telegramLogin":
                handleTelegramLogin(requestId, params);
                break;
            default:
                sendError(requestId, "UNSUPPORTED_ACTION", "Unsupported bridge action: " + action);
                break;
        }
    }

    private void handleGetInfo(@NonNull String requestId) {
        try {
            JSONObject data = new JSONObject();
            data.put("platform", "android");
            data.put("appName", appName);
            data.put("cv", cv);
            data.put("versionName", BuildConfig.VERSION_NAME);
            data.put("versionCode", BuildConfig.VERSION_CODE);
            sendSuccess(requestId, data);
        } catch (Exception e) {
            sendError(requestId, "INTERNAL_ERROR", "Failed to build app info");
        }
    }

    private void handleGoogleLogin(@NonNull String requestId, @NonNull JSONObject params) {
        String clientId = params.optString("clientId", "").trim();
        if (TextUtils.isEmpty(clientId)) {
            clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID;
        }
        GoogleAuthHelper.signIn(activity, clientId, new GoogleAuthHelper.Callback() {
            @Override
            public void onSuccess(@NonNull JSONObject data) {
                sendSuccess(requestId, data);
            }

            @Override
            public void onError(@NonNull String code, @NonNull String message) {
                sendError(requestId, code, message);
            }
        });
    }

    private void handleTelegramLogin(@NonNull String requestId, @NonNull JSONObject params) {
        String botId = params.optString("botId", "").trim();
        if (TextUtils.isEmpty(botId)) {
            botId = BuildConfig.TELEGRAM_BOT_ID;
        }
        TelegramAuthHelper.signIn(activity, botId, new TelegramAuthHelper.Callback() {
            @Override
            public void onSuccess(@NonNull JSONObject data) {
                sendSuccess(requestId, data);
            }

            @Override
            public void onError(@NonNull String code, @NonNull String message) {
                sendError(requestId, code, message);
            }
        });
    }

    private void sendSuccess(@NonNull String requestId, @NonNull JSONObject data) {
        try {
            JSONObject response = new JSONObject();
            response.put("ok", true);
            response.put("data", data);
            deliverCallback(requestId, response);
        } catch (Exception ignored) {
        }
    }

    private void sendError(@NonNull String requestId, @NonNull String code, @NonNull String message) {
        try {
            JSONObject error = new JSONObject();
            error.put("code", code);
            error.put("message", message);
            JSONObject response = new JSONObject();
            response.put("ok", false);
            response.put("error", error);
            deliverCallback(requestId, response);
        } catch (Exception ignored) {
        }
    }

    private void deliverCallback(@NonNull String requestId, @NonNull JSONObject response) {
        if (TextUtils.isEmpty(requestId) || activity.isFinishing() || activity.isDestroyed()) {
            return;
        }
        String script = "window.__aggamesBridgeCallback && window.__aggamesBridgeCallback("
                + JSONObject.quote(requestId) + ", " + response.toString() + ");";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }
}
