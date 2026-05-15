plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.chaquo.python")
}

android {
    namespace = "com.cat.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.cat.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            python {
                srcDirs.from("src/main/python")
            }
        }
    }
}

chaquopy {
    defaultConfig {
        version = System.getProperty("python.version", "3.11")
        pip {
            install("fastapi==0.104.1")
            install("uvicorn[standard]==0.24.0")
            install("sqlalchemy==2.0.23")
            install("pydantic==2.5.2")
            install("python-multipart==0.0.6")
            install("httpx==0.25.2")
            install("aiofiles==23.2.1")
            install("openpyxl==3.1.2")
            install("jinja2==3.1.2")
            install("aiosqlite==0.19.0")
        }
    }
    
    packaging {
        jniLibsKeepDebugPattern += listOf("lib/**/libc++_shared.so")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.webkit:webkit:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
}
