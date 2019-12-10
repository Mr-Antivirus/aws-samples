'use strict';

const S3 = require('aws-sdk/clients/s3');
const mongoose = require('mongoose');
mongoose.Promise = Promise;

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

exports.handler = async function(event, context, callback) {
    if (typeof event.queryStringParameters.key === 'undefined')
        return { statusCode: 401, body: "'key' is a required query param." }

    try {
        await initDB(context);

        const s3 = new S3({
            aws_access_key_id: process.env.AWS_ACCESS_KEY,
            aws_secret_access_key: process.env.AWS_SECRET_KEY
        });

        // Delete the file
        const FileModel = mongoConnection.model('File');
        // If there is an error, it'll go to the catch function
        await FileModel.findOneAndDelete({ key: event.queryStringParameters.key });

        const params = {
            Key: event.queryStringParameters.key,
            Bucket: 'youvr'
        }
        await s3.deleteObject(params).promise();

        return {
            statusCode: 200,
            body: "File successfully deleted."
        }
    }
    catch (err) {
        console.error(err, err.stack);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: err.message
            })
        }
    }
}