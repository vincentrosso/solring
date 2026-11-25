package us.ndex.solring;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Thin native shell around the hosted web app. All logic lives in the page, so a
 * web deploy updates the app with no store release. The access code is kept in
 * the page's own storage: sign in once by typing the code or pasting the magic link.
 */
public class MainActivity extends Activity {
    private static final String APP_URL = "https://solring.ndex.us/";
    private static final String APP_HOST = "solring.ndex.us";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);      // localStorage: the access code
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (APP_HOST.equals(uri.getHost())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, uri));   // anything else opens in the browser
                return true;
            }

            /** No signal: say so and offer a retry. */
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                String html = "<meta name='viewport' content='width=device-width, initial-scale=1'>"
                        + "<body style='font:17px sans-serif;padding:48px 24px;text-align:center;background:#f6f4ef;color:#1c1a24'>"
                        + "<h2>No connection</h2><p>Sol Ring needs the internet.</p>"
                        + "<p><a href='" + APP_URL + "' style='color:#a8791a;font-weight:600'>Try again</a></p></body>";
                view.loadDataWithBaseURL(APP_URL, html, "text/html", "utf-8", APP_URL);
            }
        });
        if (state == null) web.loadUrl(APP_URL); else web.restoreState(state);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
