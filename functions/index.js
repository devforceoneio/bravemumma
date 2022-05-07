const functions = require("firebase-functions");
const admin = require("./admin")();
const downloads = require("./downloads");
const users = require("./users");
const webhooks = require("./webhooks");
const https = functions.region("asia-northeast1").https;
const FieldValue = require("firebase-admin").firestore.FieldValue;

module.exports.downloads = https.onRequest(downloads);
module.exports.users = https.onRequest(users);
module.exports.webhooks = https.onRequest(webhooks);

class UnauthenticatedError extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.type = "UnauthenticatedError";
  }
}

class NotAnAdminError extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.type = "NotAnAdminError";
  }
}

class InvalidRoleError extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.type = "InvalidRoleError";
  }
}

function roleIsValid(role) {
  const validRoles = ["member", "admin"];
  return validRoles.includes(role);
}

module.exports.createUser = functions.https.onCall(async (data, context) => {
  try {
    //Checking that the user calling the Cloud Function is authenticated
    if (!context.auth) {
      throw new UnauthenticatedError(
        "The user is not authenticated. Only authenticated Admin users can create new users.",
      );
    }

    //Checking that the user calling the Cloud Function is an Admin user
    const callerUid = context.auth.uid; //uid of the user calling the Cloud Function
    const callerUserRecord = await admin.auth().getUser(callerUid);
    console.log("callerUserRecord: " + JSON.stringify(callerUserRecord));
    if (!callerUserRecord.customClaims.admin) {
      throw new NotAnAdminError("Only Admin users can create new users.");
    }

    //Checking that the new user role is valid
    const role = data.role;
    const requestId = data.requestId;
    if (!roleIsValid(role)) {
      throw new InvalidRoleError('The "' + role + '" role is not a valid role');
    }

    const newUser = {
      email: data.emailAddress,
      emailVerified: false,
      // password: data.password,
      displayName: data.firstName + " " + data.lastName,
      disabled: false,
    };

    const userRecord = await admin.auth().createUser(newUser);

    const userId = userRecord.uid;

    const claims = {};
    claims[role] = "member";

    await admin.auth().setCustomUserClaims(userId, claims);

    await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .set(newUser, { merge: true });

    if (requestId) {
      await admin
        .firestore()
        .collection("userSignupRequests")
        .doc(requestId)
        .update({ status: "approved" });
    }
    return { result: "The new user has been successfully created." };
  } catch (error) {
    if (error.type === "UnauthenticatedError") {
      throw new functions.https.HttpsError("unauthenticated", error.message);
    } else if (
      error.type === "NotAnAdminError" ||
      error.type === "InvalidRoleError"
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        error.message,
      );
    } else {
      throw new functions.https.HttpsError("internal", error.message);
    }
  }
});

// module.exports.userSignup = functions.https.onCall(async (data, context) => {
//   try {
//     //Checking that the user calling the Cloud Function is authenticated
//     if (!context.auth) {
//       throw new UnauthenticatedError(
//         "The user is not authenticated. Only authenticated Admin users can create new users.",
//       );
//     }

//     //Checking that the user calling the Cloud Function is an Admin user
//     const callerUid = context.auth.uid; //uid of the user calling the Cloud Function
//     const callerUserRecord = await admin.auth().getUser(callerUid);
//     console.log("callerUserRecord: " + JSON.stringify(callerUserRecord));
//     if (callerUserRecord.customClaims.role !== "admin") {
//       throw new NotAnAdminError("Only Admin users can create new users.");
//     }

//     //Checking that the new user role is valid
//     const role = data.role;
//     if (!roleIsValid(role)) {
//       throw new InvalidRoleError('The "' + role + '" role is not a valid role');
//     }

//     const userSignupRequest = {
//       userDetails: data,
//       status: "Pending",
//       createdBy: callerUid,
//       createdOn: FieldValue.serverTimestamp(),
//     };

//     const userSignupRequestsRef = await admin
//       .firestore()
//       .collection("userSignupRequests")
//       .add(userSignupRequest);

//     const newUser = {
//       email: data.email,
//       emailVerified: false,
//       // password: data.password,
//       displayName: data.firstName + " " + data.lastName,
//       disabled: false,
//     };

//     const userRecord = await admin.auth().createUser(newUser);

//     const userId = userRecord.uid;

//     const claims = {};
//     claims[role] = "member";

//     await admin.auth().setCustomUserClaims(userId, claims);

//     await admin.firestore().collection("users").doc(userId).set(data);

//     await userSignupRequestsRef.update({ status: "Treated" });

//     return { result: "The new user has been successfully created." };
//   } catch (error) {
//     if (error.type === "UnauthenticatedError") {
//       throw new functions.https.HttpsError("unauthenticated", error.message);
//     } else if (
//       error.type === "NotAnAdminError" ||
//       error.type === "InvalidRoleError"
//     ) {
//       throw new functions.https.HttpsError(
//         "failed-precondition",
//         error.message,
//       );
//     } else {
//       throw new functions.https.HttpsError("internal", error.message);
//     }
//   }
// });
