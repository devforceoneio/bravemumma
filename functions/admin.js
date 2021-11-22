let adminInstance;

const admin = () => {
  if (!adminInstance) {
    adminInstance = require("firebase-admin");
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      const serviceAccount = require("../../service-account-bravemumma.json");
      adminInstance.initializeApp({
        credential: adminInstance.credential.cert(serviceAccount),
      });
    } else {
      adminInstance.initializeApp();
    }
  }
  return adminInstance;
};

module.exports = admin;
