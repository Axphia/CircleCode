package org.axphia.circlecode.sample;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.axphia.circlecode.CircleCode;

/**
 * CircleCode Android Sample Activity (Java + JNI)
 * Demonstrates generating a LonCle SVG barcode and rendering it in a WebView,
 * plus decoding RGBA camera frames using CircleCode.scanRgbaJson().
 */
public class MainActivity extends Activity {

    private TextView statusView;
    private WebView svgWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad = 32;
        layout.setPadding(pad, pad, pad, pad);

        statusView = new TextView(this);
        svgWebView = new WebView(this);

        layout.addView(statusView);
        layout.addView(svgWebView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 800));
        setContentView(layout);

        // 1. Generate CircleCode SVG in LonCle mode
        String payload = "Table-24";
        String svg = CircleCode.encodeSvg(payload, 5, 0.35f, true, "Pay");
        if (svg != null) {
            statusView.setText("Generated CircleCode SVG for: " + payload);
            svgWebView.loadDataWithBaseURL(null, svg, "image/svg+xml", "UTF-8", null);
        }
    }

    /**
     * Call this from CameraX ImageAnalysis.Analyzer with RGBA_8888 frame bytes
     */
    public void onCameraRgbaFrame(byte[] rgbaBytes, int width, int height) {
        String jsonResult = CircleCode.scanRgbaJson(rgbaBytes, width, height, true);
        if (jsonResult != null && jsonResult.contains("\"ok\":true")) {
            runOnUiThread(() -> statusView.setText("Scan Result: " + jsonResult));
        }
    }
}

