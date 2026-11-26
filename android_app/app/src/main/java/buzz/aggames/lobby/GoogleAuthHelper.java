package buzz.aggames.lobby;

import android.app.Activity;
import android.os.CancellationSignal;
import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

public final class GoogleAuthHelper {

    public interface Callback {
        void onSuccess(@NonNull JSONObject data);
        void onError(@NonNull String code, @NonNull String message);
    }

    private GoogleAuthHelper() {
    }

    public static void signIn(@NonNull Activity activity, @NonNull String serverClientId, @NonNull Callback callback) {
        if (TextUtils.isEmpty(serverClientId)) {
            callback.onError("GOOGLE_NOT_CONFIGURED", "GOOGLE_WEB_CLIENT_ID is not configured");
            return;
        }

        try {
            GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(serverClientId)
                    .setAutoSelectEnabled(false)
                    .build();

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build();

            CredentialManager credentialManager = CredentialManager.create(activity);
            credentialManager.getCredentialAsync(
                    activity,
                    request,
                    new CancellationSignal(),
                    ContextCompat.getMainExecutor(activity),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            handleCredential(result.getCredential(), callback);
                        }

                        @Override
                        public void onError(@NonNull GetCredentialException e) {
                            if (e instanceof GetCredentialCancellationException) {
                                callback.onError("USER_CANCELLED", "Google sign-in cancelled");
                            } else {
                                String msg = e.getMessage() != null ? e.getMessage() : "Google sign-in failed";
                                callback.onError("GOOGLE_SIGN_IN_FAILED", msg);
                            }
                        }
                    }
            );
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Google sign-in initialization failed";
            callback.onError("GOOGLE_SIGN_IN_ERROR", msg);
        }
    }

    private static void handleCredential(@NonNull Credential credential, @NonNull Callback callback) {
        if (credential instanceof CustomCredential
                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            try {
                GoogleIdTokenCredential tokenCredential = GoogleIdTokenCredential.createFrom(credential.getData());
                JSONObject data = new JSONObject();
                data.put("idToken", tokenCredential.getIdToken());
                data.put("email", tokenCredential.getId());
                if (tokenCredential.getDisplayName() != null) {
                    data.put("displayName", tokenCredential.getDisplayName());
                }
                if (tokenCredential.getProfilePictureUri() != null) {
                    data.put("avatarUrl", tokenCredential.getProfilePictureUri().toString());
                }
                callback.onSuccess(data);
            } catch (Exception e) {
                callback.onError("INVALID_GOOGLE_CREDENTIAL", "Failed to parse Google ID token");
            }
            return;
        }
        callback.onError("UNSUPPORTED_CREDENTIAL", "Unexpected credential type: " + credential.getType());
    }
}
