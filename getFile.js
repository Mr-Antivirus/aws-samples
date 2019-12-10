'use strict';

const S3 = require('aws-sdk/clients/s3');
const mongoose = require('mongoose');

let mongoConnection = null;

const initDB = async(context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    if (mongoConnection == null) {
        mongoConnection = await mongoose.createConnection(process.env.MONGO_URI, {
            bufferCommands: false, // Disable mongoose buffering
            bufferMaxEntries: 0, // and MongoDB driver buffering
            useUnifiedTopology: true,
            useNewUrlParser: true
        });
        mongoConnection.model('File', new mongoose.Schema({
            key: mongoose.Schema.Types.String,
            fileSize: mongoose.Schema.Types.Number,
            fileType: mongoose.Schema.Types.String,
            dateCreated: mongoose.Schema.Types.Date
        }));
    }
}

exports.handler = async function(event, context) {
    if (!event.queryStringParameters || typeof event.queryStringParameters.key === 'undefined')
        return { statusCode: 401, body: "'key' is a required query param." }

    try {
        await initDB(context);

        const s3 = new S3({
            aws_access_key_id: process.env.AWS_ACCESS_KEY,
            aws_secret_access_key: process.env.AWS_SECRET_KEY
        });

        // Get files
        const FileModel = mongoConnection.model('File');
        const file = await FileModel.findOne({ key: event.queryStringParameters.key }, { key: 1 });

        if (!file)
            return {
                statusCode: 404,
                body: JSON.stringify(`'${event.queryStringParameters.key}' can't be found. Please enter a valid key.`)
            }

        const params = {
            Key: file.key,
            Bucket: 'youvr'
        }
        const signedURL = await s3.getSignedUrlPromise('getObject', params);

        return {
            statusCode: 200,
            body: JSON.stringify({
                url: signedURL,
                filename: file.key
            })
        }
    }
    catch (err) {
        console.error(err);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: err.message
            })
        }
    }
}