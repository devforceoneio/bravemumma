const functions = require("firebase-functions");
const axios = require("axios");
const handlebars = require("handlebars");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");
const fs = require("fs");
const path = require("path");
const admin = require("../admin")();
const app = require("../express")();

const IS_PRODUCTION = functions.config().env.is_production === "true";
const FIREBASE_CONFIG =
  process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG);
const PROJECT_ID = FIREBASE_CONFIG.projectId;
const LOCATION_ID = "asia-northeast1";
const API_URL =
  process.env.FUNCTIONS_EMULATOR === "true"
    ? `http://localhost:5000/${PROJECT_ID}/${LOCATION_ID}`
    : `https://${LOCATION_ID}-${PROJECT_ID}.cloudfunctions.net`;
const PAYPAL_URL = IS_PRODUCTION
  ? "https://api-m.paypal.com/v1/notifications/verify-webhook-signature"
  : "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature";

app.post("/paypal", async (req, res) => {
  try {
    const { auth, webhook_id } = functions.config().paypalauth;
    const { api_key, domain } = functions.config().mailgunauth;
    const auth_algo = req.headers["paypal-auth-algo"];
    const cert_url = req.headers["paypal-cert-url"];
    const transmission_id = req.headers["paypal-transmission-id"];
    const transmission_sig = req.headers["paypal-transmission-sig"];
    const transmission_time = req.headers["paypal-transmission-time"];
    const webhook_event = req.body;

    const payload = {
      auth_algo,
      cert_url,
      transmission_id,
      transmission_sig,
      transmission_time,
      webhook_id,
      webhook_event,
    };

    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    };
    const response = await axios.post(PAYPAL_URL, payload, options);
    const verificationStatus = response.data.verification_status;

    if (verificationStatus === "SUCCESS") {
      const description = webhook_event.resource.purchase_units[0].description;
      const amount = webhook_event.resource.purchase_units[0].amount;
      const payer = webhook_event.resource.payer;
      const download_id = webhook_event.resource.purchase_units[0].custom_id;

      const productDoc = await admin
        .firestore()
        .collection("products")
        .doc(download_id)
        .get();
      let productData;
      if (!productDoc.exists) {
        throw new Error(`Cannot find product data for ${download_id}`);
      }
      productData = productDoc.data();

      if (
        webhook_event.event_type === "CHECKOUT.ORDER.APPROVED" &&
        amount.currency_code === productData.currency_code &&
        amount.value === `${productData.value}`
      ) {
        const purchasesRef = admin
          .firestore()
          .collection(`purchases-${download_id}`)
          .doc(payer.payer_id);

        await purchasesRef.set(
          {
            payer,
            download_id,
            available_downloads: 2,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        const smtpTransport = nodemailer.createTransport(
          mg({
            auth: {
              api_key: api_key,
              domain: domain,
            },
          })
        );
        const emailTemplateSource = fs.readFileSync(
          path.join(__dirname, "../views/email.handlebars"),
          "utf8"
        );

        handlebars.registerHelper("link", (my_link) => {
          const url = handlebars.escapeExpression(my_link);
          const result = "<a href='" + url + "'>" + my_link + "</a>";
          return new handlebars.SafeString(result);
        });

        const template = handlebars.compile(emailTemplateSource);
        const htmlToSend = template({
          name: payer.name.given_name,
          product: description,
          downloadLink: `${API_URL}/downloads?payer_id=${payer.payer_id}&download_id=${download_id}`,
        });

        const mailOptions = {
          from: '"Bravemumma Shop" <no-reply@shop.bravemumma.com>',
          to: IS_PRODUCTION ? payer.email_address : "mthommo79@gmail.com",
          subject: `${
            IS_PRODUCTION ? "" : "[TEST] "
          }Your Bravemumma order is now complete`,
          html: htmlToSend,
        };

        smtpTransport.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
          console.log(`Email sent to ${payer.email_address}`);
        });
      }
    } else {
      return res.status(500).send("Verification failed");
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (e) {
    res.status(500).send({ success: false, error: e.toString() });
  }
});

module.exports = app;
