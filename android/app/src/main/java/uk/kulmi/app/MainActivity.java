package uk.kulmi.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Android 15+ forces edge-to-edge (the web view draws behind the status and
    // navigation bars). Pad the content by the system-bar insets so nothing —
    // e.g. the bottom action buttons — ever hides behind the navigation bar.
    final View content = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
      Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
      v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
      return insets;
    });

    // Kill pinch / double-tap zoom and the overscroll "stretch" so pages can't be
    // dragged/stretched like a web page.
    WebView web = this.bridge != null ? this.bridge.getWebView() : null;
    if (web != null) {
      WebSettings s = web.getSettings();
      s.setSupportZoom(false);
      s.setBuiltInZoomControls(false);
      s.setDisplayZoomControls(false);
      web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
  }
}
