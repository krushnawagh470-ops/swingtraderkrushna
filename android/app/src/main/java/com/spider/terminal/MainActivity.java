package com.spider.terminal;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;

import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://spider-121.web.app/";
    private static final int RECORD_AUDIO_REQUEST = 9101;

    private WebView webView;
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;
    private String pendingTtsText = "";
    private String pendingTtsLanguage = "en-IN";
    private String pendingRecognitionLanguage = "en-IN";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(5, 9, 22));
        getWindow().setNavigationBarColor(Color.rgb(5, 9, 22));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 9, 22));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new SpiderBridge(), "SpiderNative");
        setContentView(webView);

        if (savedInstanceState == null) webView.loadUrl(APP_URL);
        else webView.restoreState(savedInstanceState);
    }

    private class SpiderBridge {
        @JavascriptInterface
        public void startListening(String language) {
            pendingRecognitionLanguage = safeLanguage(language);
            runOnUiThread(() -> startNativeRecognition());
        }

        @JavascriptInterface
        public void stopListening() {
            runOnUiThread(() -> {
                if (speechRecognizer != null) speechRecognizer.cancel();
                callJs("window.spiderNativeSpeechState && window.spiderNativeSpeechState('stopped');");
            });
        }

        @JavascriptInterface
        public void speak(String text, String language) {
            String safeText = text == null ? "" : text.trim();
            if (safeText.length() > 3500) safeText = safeText.substring(0, 3500);
            pendingTtsText = safeText;
            pendingTtsLanguage = safeLanguage(language);
            runOnUiThread(() -> startNativeTts());
        }

        @JavascriptInterface
        public void stopSpeaking() {
            runOnUiThread(() -> {
                if (textToSpeech != null) textToSpeech.stop();
                callJs("window.spiderNativeTtsState && window.spiderNativeTtsState('done');");
            });
        }
    }

    private String safeLanguage(String language) {
        if (language == null) return "en-IN";
        String value = language.trim();
        if (value.length() < 2 || value.length() > 12 || !value.matches("[A-Za-z-]+")) return "en-IN";
        return value;
    }

    private void startNativeRecognition() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, RECORD_AUDIO_REQUEST);
            callJs("window.spiderNativeSpeechState && window.spiderNativeSpeechState('permission');");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            callJs("window.spiderNativeSpeechError && window.spiderNativeSpeechError('Speech recognition is not available. Install or enable Google speech services on Android.');");
            return;
        }
        try {
            if (speechRecognizer != null) speechRecognizer.destroy();
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {
                    callJs("window.spiderNativeSpeechState && window.spiderNativeSpeechState('listening');");
                }
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {
                    callJs("window.spiderNativeSpeechState && window.spiderNativeSpeechState('ended');");
                }
                @Override public void onError(int error) {
                    String message;
                    switch (error) {
                        case SpeechRecognizer.ERROR_NO_MATCH:
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                            message = "No speech detected. Tap Talk to AI and try again.";
                            break;
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                            message = "Microphone permission is required. Allow it in Android app settings.";
                            break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                            message = "Android speech service has a network problem. Check your connection.";
                            break;
                        default:
                            message = "Android speech recognition error (" + error + "). Try again.";
                    }
                    callJs("window.spiderNativeSpeechError && window.spiderNativeSpeechError(" + JSONObject.quote(message) + ");");
                }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> matches = results == null ? null :
                            results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String spoken = matches != null && !matches.isEmpty() ? matches.get(0) : "";
                    callJs("window.spiderNativeSpeechResult && window.spiderNativeSpeechResult(" + JSONObject.quote(spoken) + ");");
                }
                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, pendingRecognitionLanguage);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, pendingRecognitionLanguage);
            intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            speechRecognizer.startListening(intent);
        } catch (Exception error) {
            String message = error.getMessage() == null ? "Could not start Android speech recognition." : error.getMessage();
            callJs("window.spiderNativeSpeechError && window.spiderNativeSpeechError(" + JSONObject.quote(message) + ");");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == RECORD_AUDIO_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startNativeRecognition();
            } else {
                callJs("window.spiderNativeSpeechError && window.spiderNativeSpeechError('Microphone permission denied. Allow microphone access to use Talk to AI.');");
            }
        }
    }

    private void startNativeTts() {
        if (pendingTtsText == null || pendingTtsText.trim().isEmpty()) return;
        if (textToSpeech == null) {
            textToSpeech = new TextToSpeech(this, status -> runOnUiThread(() -> {
                ttsReady = status == TextToSpeech.SUCCESS;
                if (ttsReady) {
                    textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String utteranceId) {
                            callJs("window.spiderNativeTtsState && window.spiderNativeTtsState('start');");
                        }
                        @Override public void onDone(String utteranceId) {
                            callJs("window.spiderNativeTtsState && window.spiderNativeTtsState('done');");
                        }
                        @Override public void onError(String utteranceId) {
                            callJs("window.spiderNativeTtsState && window.spiderNativeTtsState('error');");
                        }
                    });
                    speakPendingText();
                } else {
                    callJs("window.spiderNativeTtsState && window.spiderNativeTtsState('error');");
                }
            }));
            return;
        }
        if (ttsReady) speakPendingText();
    }

    private void speakPendingText() {
        if (textToSpeech == null || !ttsReady || pendingTtsText == null || pendingTtsText.isEmpty()) return;
        Locale locale = Locale.forLanguageTag(pendingTtsLanguage);
        int languageStatus = textToSpeech.setLanguage(locale);
        if (languageStatus == TextToSpeech.LANG_MISSING_DATA || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
            languageStatus = textToSpeech.setLanguage(new Locale("en", "IN"));
            if (languageStatus == TextToSpeech.LANG_MISSING_DATA || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
                textToSpeech.setLanguage(Locale.US);
            }
        }
        String utteranceId = "spider-" + System.currentTimeMillis();
        int result = textToSpeech.speak(pendingTtsText, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
        pendingTtsText = "";
        if (result == TextToSpeech.ERROR) {
            callJs("window.spiderNativeTtsState && window.spiderNativeTtsState('error');");
        }
    }

    private void callJs(String script) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (speechRecognizer != null) {
            speechRecognizer.cancel();
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
