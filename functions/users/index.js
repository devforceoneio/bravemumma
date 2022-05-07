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

module.exports.userSignupRequestsUpdates = functions.firestore
  .document("userSignupRequests/{uid}")
  .onUpdate((change, context) => {
    return change.after.ref.set(
      {
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  });

// app.post("/setCustomClaim", async (req, res) => {
//   try {
//     console.log("headers: " + JSON.stringify(req.headers));
//     console.log("body: " + JSON.stringify(req.body));

//     const { uid } = req.body;

//     await admin.auth().setCustomUserClaims(uid, { admin: true });

//     return res.status(200).send("EVENT_RECEIVED");
//   } catch (e) {
//     console.log("error: " + JSON.stringify(e));
//     return res.status(500).send({ success: false, error: e.toString() });
//   }
// });

app.post("/userSignup", async (req, res) => {
  try {
    console.log("headers: " + JSON.stringify(req.headers));
    console.log("body: " + JSON.stringify(req.body));

    const { api_key } = functions.config().sendgridauth;
    const { firstName, lastName, emailAddress, results } = req.body;

    const userSignupRequest = {
      userDetails: {
        firstName,
        lastName,
        emailAddress,
      },
      questionnaire: JSON.stringify(results),
      status: "pending",
      createdOn: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin
      .firestore()
      .collection("userSignupRequests")
      .add(userSignupRequest);

    const smtpTransport = nodemailer.createTransport(
      sgTransport({
        auth: {
          api_key: api_key,
        },
      }),
    );
    const emailTemplateSource = fs.readFileSync(
      path.join(__dirname, "../views/membership_request_email.handlebars"),
      "utf8",
    );

    handlebars.registerHelper("link", (my_link) => {
      const url = handlebars.escapeExpression(my_link);
      const result = "<a href='" + url + "'>" + my_link + "</a>";
      return new handlebars.SafeString(result);
    });

    const template = handlebars.compile(emailTemplateSource);

    const htmlToSend = template({
      firstname,
      lastname,
      emailaddress,
      results,
    });

    const mailOptions = {
      from: '"Bravemumma" <no-reply@shop.bravemumma.com>',
      to: !IS_PRODUCTION
        ? "mthommo79@gmail.com"
        : "griffensoftwareoz@gmail.com",
      subject: `${
        IS_PRODUCTION ? "" : "[TEST] "
      }Request to join Bravemummahood`,
      html: htmlToSend,
    };

    smtpTransport.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("error sending email: " + JSON.stringify(error));
        return;
      }
      console.log(
        `Email sent to ${
          !IS_PRODUCTION ? "mthommo79@gmail.com" : "griffensoftwareoz@gmail.com"
        }`,
      );
    });

    return res.status(200).send("EVENT_RECEIVED");
  } catch (e) {
    console.log("error: " + JSON.stringify(e));
    return res.status(500).send({ success: false, error: e.toString() });
  }
});

app.post("/updateRequest", async (req, res) => {
  try {
    console.log("headers: " + JSON.stringify(req.headers));
    console.log("body: " + JSON.stringify(req.body));

    const { api_key } = functions.config().sendgridauth;
    const { firstname, lastname, emailaddress, results } = req.body;

    const requestsRef = admin
      .firestore()
      .collection("requests")
      .doc(emailaddress);

    await requestsRef.set(
      {
        firstName: firstname,
        lastName: lastname,
        emailAddress: emailaddress,
        results,
        status: "pending",
        requestEmailSent: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    const smtpTransport = nodemailer.createTransport(
      sgTransport({
        auth: {
          api_key: api_key,
        },
      }),
    );
    const emailTemplateSource = fs.readFileSync(
      path.join(__dirname, "../views/membership_request_email.handlebars"),
      "utf8",
    );

    handlebars.registerHelper("link", (my_link) => {
      const url = handlebars.escapeExpression(my_link);
      const result = "<a href='" + url + "'>" + my_link + "</a>";
      return new handlebars.SafeString(result);
    });

    const template = handlebars.compile(emailTemplateSource);
    console.log("Here 2");
    const htmlToSend = template({
      firstname,
      lastname,
      emailaddress,
      results,
    });

    const mailOptions = {
      from: '"Bravemumma" <no-reply@shop.bravemumma.com>',
      to: !IS_PRODUCTION
        ? "mthommo79@gmail.com"
        : "griffensoftwareoz@gmail.com",
      subject: `${
        IS_PRODUCTION ? "" : "[TEST] "
      }Request to join Bravemummahood`,
      html: htmlToSend,
    };

    smtpTransport.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("error sending email: " + JSON.stringify(error));
        return;
      }
      console.log(
        `Email sent to ${
          !IS_PRODUCTION ? "mthommo79@gmail.com" : "griffensoftwareoz@gmail.com"
        }`,
      );
    });

    return res.status(200).send("EVENT_RECEIVED");
  } catch (e) {
    console.log("error: " + JSON.stringify(e));
    return res.status(500).send({ success: false, error: e.toString() });
  }
});

module.exports = app;
