const functions = require("firebase-functions");
const axios = require("axios");
const handlebars = require("handlebars");
const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");
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
const PAYPAL_AUTH_TOKEN_URL = IS_PRODUCTION
  ? "https://api-m.paypal.com/v1/oauth2/token"
  : "https://api-m.sandbox.paypal.com/v1/oauth2/token";
const PAYPAL_VERIFY_WEBHOOK_SIGNATURE_URL = IS_PRODUCTION
  ? "https://api-m.paypal.com/v1/notifications/verify-webhook-signature"
  : "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature";

app.post("/paypal", async (req, res) => {
  try {
    console.log("headers: " + JSON.stringify(req.headers));
    console.log("body: " + JSON.stringify(req.body));

    const { client_id, client_secret, webhook_id } =
      functions.config().paypalauth;
    // Get auth token and check expiry
    const paypalAuthRef = admin.firestore().collection("auth").doc("paypal");
    const paypalAuthDoc = await paypalAuthRef.get();

    let paypalAuthData;
    if (!paypalAuthDoc.exists) {
      console.log(
        `Cannot find paypal auth data, will attempt to get new token`
      );
    } else {
      paypalAuthData = paypalAuthDoc.data();
    }

    let access_token;
    const currentTime = Date.now();
    if (
      !paypalAuthData ||
      !paypalAuthData.expires_at ||
      paypalAuthData.expires_at <= currentTime
    ) {
      if (paypalAuthData.expires_at <= currentTime) {
        console.log(`Token is expired, will attempt to get a new token`);
      }
      const headers = { "Content-Type": "application/x-www-form-urlencoded" };
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");

      const authTokenResponse = await axios({
        headers,
        method: "post",
        url: PAYPAL_AUTH_TOKEN_URL,
        auth: {
          username: client_id,
          password: client_secret,
        },
        params,
      });

      access_token = authTokenResponse.data.access_token;
      const expires_at = currentTime + authTokenResponse.data.expires_in * 1000;

      await paypalAuthRef.set(
        {
          access_token,
          expires_at,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      access_token = paypalAuthData.access_token;
    }

    const { api_key } = functions.config().sendgridauth;
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
        Authorization: `Bearer ${access_token}`,
      },
    };
    const response = await axios.post(
      PAYPAL_VERIFY_WEBHOOK_SIGNATURE_URL,
      payload,
      options
    );
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

      if (webhook_event.event_type === "CHECKOUT.ORDER.APPROVED") {
        if (amount.currency_code !== productData.currency_code) {
          throw new Error("Product data currency code does not match");
        }
        if (amount.value !== `${productData.value}`) {
          throw new Error("Product data value does not match amount");
        }

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
          sgTransport({
            auth: {
              api_key: api_key,
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
          from: '"Bravemumma" <no-reply@shop.bravemumma.com>',
          to: IS_PRODUCTION ? payer.email_address : "mark@griffenapps.io",
          subject: `${
            IS_PRODUCTION ? "" : "[TEST] "
          }Your Bravemumma order is now complete`,
          html: htmlToSend,
        };

        smtpTransport.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log("error sending email: " + JSON.stringify(error));
            return;
          }
          console.log(
            `Email sent to ${
              IS_PRODUCTION ? payer.email_address : "mark@griffenapps.io"
            }`
          );
        });
      }
    } else {
      console.log(
        "error verification response: " + JSON.stringify(response.data)
      );
      return res.status(500).send("Verification failed");
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (e) {
    console.log("error: " + e.toString());
    res.status(500).send({ success: false, error: e.toString() });
  }
});

module.exports = app;
