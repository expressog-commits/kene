package ci.kene.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private static final String APP_HOST = "kene-web-production.up.railway.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge currentBridge = getBridge();
        if (currentBridge != null) {
            currentBridge.setWebViewClient(new KeneWebViewClient(currentBridge));
        }

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    Bridge activeBridge = getBridge();
                    WebView webView = activeBridge != null ? activeBridge.getWebView() : null;
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                        return;
                    }
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        );
    }

    private class KeneWebViewClient extends BridgeWebViewClient {

        KeneWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (request != null && !request.isForMainFrame()) {
                return false;
            }
            Uri uri = request != null ? request.getUrl() : null;
            if (handleExternalUri(uri)) {
                return true;
            }
            return super.shouldOverrideUrlLoading(view, request);
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = url != null ? Uri.parse(url) : null;
            if (handleExternalUri(uri)) {
                return true;
            }
            return super.shouldOverrideUrlLoading(view, url);
        }
    }

    private boolean handleExternalUri(Uri uri) {
        if (!shouldOpenExternally(uri)) {
            return false;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException ignored) {
            // Ignore when no external handler is installed on the device.
        }
        return true;
    }

    private static boolean shouldOpenExternally(Uri uri) {
        if (uri == null) {
            return false;
        }
        if (uri.isHierarchical() && "embed".equalsIgnoreCase(uri.getQueryParameter("output"))) {
            return false;
        }
        String scheme = uri.getScheme();
        if (scheme == null) {
            return false;
        }
        String lowerScheme = scheme.toLowerCase(Locale.ROOT);
        if (
            "tel".equals(lowerScheme) ||
            "mailto".equals(lowerScheme) ||
            "geo".equals(lowerScheme) ||
            "whatsapp".equals(lowerScheme)
        ) {
            return true;
        }
        if ("http".equals(lowerScheme) || "https".equals(lowerScheme)) {
            String host = uri.getHost();
            if (host == null) {
                return false;
            }
            String lowerHost = host.toLowerCase(Locale.ROOT);
            if (APP_HOST.equals(lowerHost) || "localhost".equals(lowerHost)) {
                return false;
            }
            if (
                "wa.me".equals(lowerHost) ||
                "api.whatsapp.com".equals(lowerHost) ||
                "maps.google.com".equals(lowerHost) ||
                "maps.app.goo.gl".equals(lowerHost)
            ) {
                return true;
            }
            if ("www.google.com".equals(lowerHost) || "google.com".equals(lowerHost)) {
                String path = uri.getPath();
                return path != null && path.startsWith("/maps");
            }
        }
        return false;
    }
}
