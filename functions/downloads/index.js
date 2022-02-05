const path = require("path");
const admin = require("../admin")();
const app = require("../express")();
const { getS3Object } = require("../aws");

app.get("/", async (req, res) => {
  try {
    const payer_id = req.query["payer_id"];
    const download_id = req.query["download_id"];

    if (payer_id && download_id) {
      const purchasesRef = admin
        .firestore()
        .collection(`purchases-${download_id}`)
        .doc(payer_id);
      const purchaseDoc = await purchasesRef.get();
      if (purchaseDoc.exists) {
        const { available_downloads } = purchaseDoc.data();

        if (available_downloads > 0) {
          await purchasesRef.set(
            {
              available_downloads: available_downloads - 1,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          // Get product data from Firestore
          const productDoc = await admin
            .firestore()
            .collection("products")
            .doc(download_id)
            .get();
          if (!productDoc.exists) {
            throw new Error(`Cannot find product data for ${download_id}`);
          }
          const productData = productDoc.data();

          // Get file from S3
          const data = await getS3Object({
            bucket: "bravemumma.com-storage",
            key: productData.filename,
          });
          res.attachment(productData.filename);
          res.type(data.ContentType);
          res.send(data.Body);
        } else {
          console.log(
            "No available downloads for " +
              download_id +
              " and user " +
              payer_id
          );
          res.status(200).sendFile(path.join(__dirname, "../views/error.html"));
        }
      }
    }
  } catch (e) {
    console.log("error: " + JSON.stringify(e));
    res.status(500).send({ success: false, error: e.toString() });
  }
});

module.exports = app;
