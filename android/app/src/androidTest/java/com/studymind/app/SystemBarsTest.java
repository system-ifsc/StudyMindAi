package com.studymind.app;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.view.ViewGroup;
import android.view.WindowInsetsController;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.ActivityTestRule;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Verifies actual window geometry and rendered system-bar pixels, not just theme values. */
@RunWith(AndroidJUnit4.class)
public class SystemBarsTest {
    @Rule public ActivityTestRule<MainActivity> activity = new ActivityTestRule<>(MainActivity.class);

    @Test public void systemBarsHaveNoWhiteStrips() throws Throwable {
        activity.runOnUiThread(() -> {
            ViewGroup content = activity.getActivity().findViewById(android.R.id.content);
            ViewGroup root = (ViewGroup) content.getChildAt(0);
            WebView web = (WebView) root.getChildAt(0);
            web.stopLoading();
            web.loadData("<html><body style='margin:0;background:#0f0e14'></body></html>",
                    "text/html", "UTF-8");
            assertEquals(0, content.getTop());
            assertTrue("Status bar inset must protect the header", root.getPaddingTop() > 0);
            if (Build.VERSION.SDK_INT >= 30) {
                int appearance = activity.getActivity().getWindow().getInsetsController()
                        .getSystemBarsAppearance();
                assertEquals(0, appearance & (WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS));
            }
        });
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        // Wait for the compositor to present the updated window before sampling the screenshot.
        android.os.SystemClock.sleep(1200);
        Bitmap screen = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(screen);
        int shell = Color.rgb(15, 14, 20);
        // Sample away from clock/status icons and the navigation gesture/buttons.
        assertEquals("Top system bar must show the app background", shell,
                screen.getPixel(screen.getWidth() / 2, 2));
        assertEquals("Bottom system bar must show the app background", shell,
                screen.getPixel(2, screen.getHeight() - 2));
        screen.recycle();
    }
}
