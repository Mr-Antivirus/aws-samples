'use strict';

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
    try {
        await initDB(context);

        const FileModel = mongoConnection.model('File');
        const result = await FileModel.find({}, { _id: 0, __v: 0 }).sort({ dateCreated: -1 });
        console.log(result);

        return {
            statusCode: 200,
            body: JSON.stringify(result)
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