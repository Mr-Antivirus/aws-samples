'use strict';

const S3 = require('aws-sdk/clients/s3');
const mimeTypes = require('mime-types');
const shortid = require('shortid');
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
const s3 = new S3({
    aws_access_key_id: process.env.AWS_ACCESS_KEY,
    aws_secret_access_key: process.env.AWS_SECRET_KEY
});

const saveToDB = async(data) => {
    try {
        // Create a new record
        data.dateCreated = new Date();
        data.url = 'https://youvr.s3.ap-northeast-2.amazonaws.com/' + data.key;

        const FileModel = mongoConnection.model('File');
        const result = await FileModel.create(data);
        console.log(result)
        return result;
    }
    catch (err) {
        console.error(err);
        return null;
    }
}

const createPresignedPostPromise = (params) => {
    return new Promise((resolve, reject) => {
        s3.createPresignedPost(params, (err, data) => {
            err ? reject(err) : resolve(data);
        });
    });
}

exports.handler = async function(event, context) {
    const metadata = JSON.parse(event.body)

    if (typeof metadata.filesize === 'undefined')
        return { statusCode: 401, body: "'filesize' is a required query param." }

    if (typeof metadata.filetype === 'undefined')
        return { statusCode: 401, body: "'filetype' is a required query param." }

    try {
        await initDB(context);
        
        const curDate = new Date();
        const date = {
            day: curDate.getDate(),
            month: curDate.getMonth() + 1,
            year: curDate.getFullYear()
        }

        const filename = `${date.year}/${date.month}/${date.day}/${shortid.generate(10)}.${metadata.filetype}`;

        const params = {
            Bucket: "youvr",
            Expires: 3600,
            Fields: {
                key: filename,
            },
            // Conditions: [
            //     ['content-length-range', 0, event.body.filesize],
            //     ['starts-with', '$Content-Type', mimeTypes.contentType(metadata.filetype)]
            // ]
        }

        const result = await createPresignedPostPromise(params); //s3.createPresignedPost(params).promise();
        console.log(result)
        console.log(mimeTypes.contentType(metadata.filetype))

        await saveToDB({
            key: filename,
            fileSize: metadata.filesize,
            fileType: metadata.filetype
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                url: result.url,
                fields: result.fields
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
