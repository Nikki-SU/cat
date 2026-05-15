package com.cat.app

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform

class PythonService : Service() {

    private val CHANNEL_ID = "cat_python_service"
    private val NOTIFICATION_ID = 1
    private var pythonThread: Thread? = null

    override fun onCreate() {
        super.onCreate()
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(this))
        }
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("Cat is starting...")
        startForeground(NOTIFICATION_ID, notification)

        // Start Python server in background thread
        pythonThread = Thread {
            try {
                val python = Python.getInstance()
                val module = python.getModule("cat_server")
                // Pass app's files directory to Python
                module.callAttr("start_server", filesDir.absolutePath)
            } catch (e: Exception) {
                e.printStackTrace()
                // Update notification with error
                val errorNotification = createNotification("Cat error: ${e.message}")
                val manager = getSystemService(NotificationManager::class.java)
                manager.notify(NOTIFICATION_ID + 1, errorNotification)
            }
        }
        pythonThread?.start()

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        pythonThread?.interrupt()
        pythonThread = null
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Cat Background Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keep Cat server running"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Cat")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_manage)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
