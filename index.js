import { Voice, neru } from 'neru-alpha';
import Util from 'util';
// console.log(process.env);

const BASE_URL = process.env.ENDPOINT_URL_SCHEME;
const INSTANCE_SRV_NAME = process.env.INSTANCE_SERVICE_NAME;
const NERU_CONFIGURATIONS = JSON.parse(process.env['NERU_CONFIGURATIONS']);

const router = neru.Router();

// const session = neru.createSession();
// const voice = new Voice(session);

// await voice.onVapiAnswer('onCall').execute();

// router.post('/onCall', async (req, res, next) => {
//     console.log('onCall', req.body);

//     let eventUrl = `${BASE_URL}/${INSTANCE_SRV_NAME}/webhooks/recordings`;
//     console.log("eventUrl", eventUrl);

//     res.json([{
//         action: 'talk',
//         text: 'Hello. This call will be recorded.'
//     }, {
//         action: "record",
//         endOnKey: '#',
//         beepStart: 'true',
//         endOnSilence: "3",
//         eventUrl: [ eventUrl ]
//     }, {
//         action: 'talk',
//         text: 'Thank you for your message. Goodbye.'
//     }]);
// });

// -----

import { v4 as uuidv4 } from 'uuid';
import Vonage from '@vonage/server-sdk';

// var apiKey, apiSecret, privateKey, s3Key, s3Secret
var apiKey = NERU_CONFIGURATIONS.apiKey,
    apiSecret = NERU_CONFIGURATIONS.apiSecret,
    privateKey = "./private.key",
    applicationId = NERU_CONFIGURATIONS.applicationId
var vonage;

//TODO: delete
vonage = new Vonage({
    apiKey, apiSecret, applicationId, privateKey
}, {
    debug: true
});

var awsId = NERU_CONFIGURATIONS.awsId,
    awsSecret = NERU_CONFIGURATIONS.awsSecret,
    s3Bucket = NERU_CONFIGURATIONS.s3Bucket,
    awsSessionToken = NERU_CONFIGURATIONS.awsSessionToken
    
import fs from 'fs';
import AWS from 'aws-sdk';
const s3 = new AWS.S3({
    accessKeyId: awsId,
    secretAccessKey: awsSecret,
    sessionToken: awsSessionToken
});
// TODO: Delete later. For testing aws credentials
// s3.listBuckets({}, function(err, data) {
//     if (err) console.log(err, err.stack); // an error occurred
//     else     console.log(data);  
// });

router.post('/webhooks/answer', async (req, res, next) => {
    console.log('Answer event', req.body);

    try {
        let eventUrl = `${BASE_URL}/${INSTANCE_SRV_NAME}/webhooks/recordings`;
        console.log("eventUrl", eventUrl);

        res.json([{
            action: 'talk',
            text: 'Hello. This call will be recorded.'
        }, {
            action: "record",
            endOnKey: '#',
            beepStart: 'true',
            endOnSilence: "3",
            eventUrl: [ eventUrl ]
        }, {
            action: 'talk',
            text: 'Thank you for your message. Goodbye.'
        }]);
    } catch (error) {
        res.json([{
            action: 'talk',
            text: 'I\'m sorry, we\'re unable to process your request.'
        }]);
    }
});

router.post('/webhooks/event', async (req, res, next) => {
    res.sendStatus(200);
});

router.post('/webhooks/recordings', async (req, res, next) => {
    console.log('Recording event', req.body);
    
    try {
        let { recording_url, recording_uuid, conversation_uuid } = req.body;

        // Download recording to server
        const saveRecordingFunction = Util.promisify(saveRecording);
        let saveRecordingResult = await saveRecordingFunction({
            recordingUrl: recording_url,
            filename: `recordings/${conversation_uuid}|${recording_uuid}.mp3`
        });
        console.log("saveRecordingResult", saveRecordingResult);

        // Upload to S3 bucket
        const uploadFileFunction = Util.promisify(uploadFile);
        let uploadFileResult = await uploadFileFunction({
            localFileName: `recordings/${conversation_uuid}|${recording_uuid}.mp3`,
            s3FileName: `${conversation_uuid}/${recording_uuid}.mp3`
        });
        console.log("uploadFileResult", uploadFileResult);
        let recordingUrl = uploadFileResult.Location;
        
        // Send to AWS Transcribe and upload to S3 bucket
        let jobName = uuidv4();
        let transcribeMp3Result = await transcribeMp3({
            jobName,
            languageCode: "en-US",
            mediaFormat: "mp3",
            mediaUri: recordingUrl,
            outputKey: `${conversation_uuid}/${recording_uuid}.json`
        });
        console.log("transcribeMp3Result", transcribeMp3Result);

        // Delete recording file from server
        const deleteFileFunction = Util.promisify(deleteFile);
        let deleteFileResult = await deleteFileFunction({
            localFileName: `recordings/${conversation_uuid}|${recording_uuid}.mp3`,
        });
        console.log("deleteFile", deleteFile);

        res.sendStatus(200);
    } catch (error) {
        console.log("ERR", error);
        res.send(error.message ? error.message : error);
    }
});

const saveRecording = ({ recordingUrl, filename }, callback) => {
    vonage.files.save(recordingUrl, filename, callback);
}

const uploadFile = ({ localFileName, s3FileName }, callback) => {
    const fileContent = fs.readFileSync(localFileName);
    const params = {
        Bucket: s3Bucket,
        Key: s3FileName,
        Body: fileContent
    };
    s3.upload(params, callback);
};

const deleteFile = ({ localFileName }, callback) => {
    fs.unlink(localFileName, (err) => {
        if (err) {
            return callback(error);
        }
        callback(null, "Ok");
    });
};


import {
    StartTranscriptionJobCommand,
    ListTranscriptionJobsCommand, DeleteTranscriptionJobCommand
} from "@aws-sdk/client-transcribe";

import { TranscribeClient } from "@aws-sdk/client-transcribe";

const transcribeClient = new TranscribeClient({
    region: NERU_CONFIGURATIONS.awsRegion
});

const transcribeMp3 = async ({ jobName, languageCode, mediaFormat, mediaUri, outputKey }) => {
    try {
        const data = await transcribeClient.send(
            new StartTranscriptionJobCommand({
                TranscriptionJobName: jobName,
                LanguageCode: languageCode,
                MediaFormat: mediaFormat,
                Media: {
                    MediaFileUri: mediaUri
                },
                OutputBucketName: s3Bucket,
                OutputKey: outputKey
            })
        );
        console.log("Success", data);
        return data;
    } catch (err) {
        console.log("Error", err);
    }
};

// -----
// Below are used for testing purposes

const listJobs = async({ jobName }) => {
    try {
        let params = {};
        if (jobName) {
            params = { JobNameContains: jobName };
        } 
        const data = await transcribeClient.send(
            new ListTranscriptionJobsCommand(params)
        );
        console.log("Success", data.TranscriptionJobSummaries);
        return data;
    } catch (err) {
        console.log("Error", err);
    }
};

const deleteJob = async({ jobName }) => {
    try {
        const data = await transcribeClient.send(
            new DeleteTranscriptionJobCommand({
                TranscriptionJobName: jobName
            })
        );
        console.log("Success", data);
        return data;
    } catch (err) {
        console.log("Error", err);
    }
};

router.post('/transcribe/list', async (req, res, next) => {
    try {
        let { jobName } = req.body;
        let listJobResult = await listJobs({ jobName });

        res.send(listJobResult);
    } catch (error) {
        res.send(error);
    }
});

router.post('/transcribe/delete', async (req, res, next) => {
    try {
        let { jobName } = req.body;
        if (!jobName) {
            throw(new Error("jobName is required"));
        }
        let deleteJobResult = await deleteJob({ jobName });

        res.send(deleteJobResult);
    } catch (error) {
        res.send(error);
    }
});


export { router };