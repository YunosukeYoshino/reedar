const preview = require("./electron-builder.json");

module.exports = {
  ...preview,
  forceCodeSigning: true,
  mac: {
    ...preview.mac,
    // Remove the preview's ad-hoc override so electron-builder selects a Developer ID identity.
    identity: undefined,
    hardenedRuntime: true,
    notarize: true,
  },
};
