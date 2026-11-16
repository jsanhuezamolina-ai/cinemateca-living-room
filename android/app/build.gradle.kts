plugins {
    id("com.android.application")
}

android {
    namespace = "com.jonathan.cinemateca"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jonathan.cinemateca"
        // Android TV 9 (API 28) en adelante.
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // APK de prueba instalable por sideload; no es una firma de publicación.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.documentfile:documentfile:1.0.1")
}
