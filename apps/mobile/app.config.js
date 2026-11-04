const fs = require('fs');
const path = require('path');

/**
 * app.json plus phone-OTP wiring. With google-services.json beside this file
 * (downloaded from the Firebase console) the app sends real SMS codes through
 * Firebase Phone Auth. Without it the app runs OTP in demo mode (code 123456,
 * no SMS), so builds never fail and testers can still see the flow.
 * See docs/otp.md.
 */
module.exports = ({ config }) => {
  // PF_SKIP_FIREBASE=1 is set for iOS builds until a GoogleService-Info.plist exists.
  const hasFirebase =
    fs.existsSync(path.join(__dirname, 'google-services.json')) &&
    process.env.PF_SKIP_FIREBASE !== '1';
  return {
    ...config,
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    plugins: [...(config.plugins ?? []), ...(hasFirebase ? ['@react-native-firebase/app'] : [])],
    extra: { ...config.extra, otpMode: hasFirebase ? 'firebase' : 'demo' },
  };
};
