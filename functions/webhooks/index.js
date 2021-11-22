const functions = require("firebase-functions");
const axios = require("axios");
const handlebars = require("handlebars");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");
const fs = require("fs");
const path = require("path");
const app = require("../express")();

app.post("/paypal", async (req, res) => {
  try {
    const {
      auth,
      webhook_id,
      mailgun_api_key,
      mailgun_domain,
    } = functions.config().paypalauth;
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
    const response = await axios.post(
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
      payload,
      options
    );
    const verificationStatus = response.data.verification_status;

    if (verificationStatus === "SUCCESS") {
      const description = webhook_event.resource.purchase_units[0].description;
      const amount = webhook_event.resource.purchase_units[0].amount;
      const payer = webhook_event.resource.payer;

      if (
        webhook_event.event_type === "CHECKOUT.ORDER.APPROVED" &&
        description.toLowerCase().includes("ebook") &&
        amount.currency_code === "USD" &&
        amount.value === "9.95"
      ) {
        const smtpTransport = nodemailer.createTransport(
          mg({
            auth: {
              api_key: mailgun_api_key,
              domain: mailgun_domain,
            },
          })
        );
        const emailTemplateSource = fs.readFileSync(
          path.join(__dirname, "../views/email.handlebars"),
          "utf8"
        );
        const emailAttachment = fs.readFileSync(
          path.join(__dirname, "../attachments/ebook.pdf"),
          "binary"
        );
        const template = handlebars.compile(emailTemplateSource);
        const htmlToSend = template({
          name: payer.name.given_name,
          product: "Bravemumma eBook",
        });

        var mailOptions = {
          from: '"Bravemumma" <stephanie@bravemumma.com>',
          to: payer.email_address,
          subject: "Your Bravemumma order is now complete",
          attachments: [
            {
              filename: "ebook.pdf",
              content: new Buffer(emailAttachment, "binary"),
              contentType: "application/pdf",
            },
          ],
          html: htmlToSend,
        };

        smtpTransport.sendMail(mailOptions, function (error, info) {
          if (error) {
            return console.log(error);
          }
          console.log("Message sent: " + info.response);
        });
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (e) {
    // eslint-disable-next-line object-curly-spacing
    res.status(500).send({ success: false, error: e.toString() });
  }
});

module.exports = app;
