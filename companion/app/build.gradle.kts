plugins { id("com.android.application") }

android {
    namespace = "org.moli.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.moli.companion"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.1.2"
    }
}


dependencies {
    implementation("androidx.work:work-runtime:2.10.1")
}
