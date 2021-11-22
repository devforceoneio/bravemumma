const functions = require("firebase-functions");
const webhooks = require("./webhooks");
const https = functions.region("asia-northeast1").https;

module.exports.webhooks = https.onRequest(webhooks);
