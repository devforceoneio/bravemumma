const functions = require("firebase-functions");
const AWS = require("aws-sdk");
const admin = require("../admin")();

const getS3SignedUrlDownload = (args) => {
  const { bucket, key } = args;
  const {
    access_key_id,
    secret_access_key,
    region,
  } = functions.config().awsauth;

  AWS.config.update({
    accessKeyId: access_key_id,
    secretAccessKey: secret_access_key,
    region: region,
  });
  const s3 = new AWS.S3();
  const s3Params = {
    Bucket: bucket,
    Key: key,
    Expires: 600,
  };
  return s3.getSignedUrl("getObject", s3Params);
};

const getS3Object = async (args) => {
  const { bucket, key } = args;
  const {
    access_key_id,
    secret_access_key,
    region,
  } = functions.config().awsauth;

  AWS.config.update({
    accessKeyId: access_key_id,
    secretAccessKey: secret_access_key,
    region: region,
  });
  const s3 = new AWS.S3();
  const s3Params = {
    Bucket: bucket,
    Key: key,
  };
  return s3.getObject(s3Params).promise();
};

module.exports = { getS3SignedUrlDownload, getS3Object };
