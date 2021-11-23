const functions = require("firebase-functions");
const downloads = require("./downloads");
const webhooks = require("./webhooks");
const https = functions.region("asia-northeast1").https;

module.exports.downloads = https.onRequest(downloads);
module.exports.webhooks = https.onRequest(webhooks);
