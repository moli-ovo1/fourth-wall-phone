plugins { id("com.android.application") }

android {
    namespace = "org.moli.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.moli.companion"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "0.1.6"
    }
}


dependencies {
    implementation("androidx.work:work-runtime:2.10.1")
}
