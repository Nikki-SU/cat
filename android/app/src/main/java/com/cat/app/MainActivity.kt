package com.cat.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var isServerReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        // Start Python backend service
        val serviceIntent = Intent(this, PythonService::class.java)
        startForegroundService(serviceIntent)

        // Configure WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            databaseEnabled = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                // Open external links in browser
                if (!url.startsWith("http://localhost") && !url.startsWith("http://127.0.0.1")) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "Cannot open link", Toast.LENGTH_SHORT).show()
                    }
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = ProgressBar.GONE
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress == 100) {
                    progressBar.visibility = ProgressBar.GONE
                } else {
                    progressBar.visibility = ProgressBar.VISIBLE
                }
            }
        }

        // Wait for Python server and load page
        waitForServerAndLoad()
    }

    private fun waitForServerAndLoad() {
        Thread {
            var attempts = 0
            val maxAttempts = 60 // Wait up to 30 seconds
            while (attempts < maxAttempts && !isServerReady) {
                try {
                    val url = URL("http://localhost:8000/health")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.connectTimeout = 1000
                    conn.readTimeout = 1000
                    val code = conn.responseCode
                    conn.disconnect()
                    if (code == 200) {
                        isServerReady = true
                        runOnUiThread {
                            webView.loadUrl("http://localhost:8000")
                        }
                        return@Thread
                    }
                } catch (e: Exception) {
                    // Server not ready yet
                }
                Thread.sleep(500)
                attempts++
            }
            // Timeout - try to load anyway
            runOnUiThread {
                if (!isServerReady) {
                    Toast.makeText(this, "Server timeout, trying anyway...", Toast.LENGTH_SHORT).show()
                }
                webView.loadUrl("http://localhost:8000")
            }
        }.start()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        // Stop Python service
        val serviceIntent = Intent(this, PythonService::class.java)
        stopService(serviceIntent)
        webView.destroy()
        super.onDestroy()
    }
}
