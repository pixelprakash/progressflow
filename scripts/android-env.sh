# Source this before local Android builds:  source scripts/android-env.sh
export JAVA_HOME="$HOME/dev-tools/jdk17/jdk-17.0.21+9/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
