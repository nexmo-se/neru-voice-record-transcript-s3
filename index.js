import { neru } from 'neru-alpha';
import Util from 'util';

const APP_ID = process.env.API_APPLICATION_ID;
const BASE_URL = process.env.ENDPOINT_URL_SCHEME;
const INSTANCE_SRV_NAME = process.env.INSTANCE_SERVICE_NAME;
const NERU_CONFIGURATIONS = JSON.parse(process.env['NERU_CONFIGURATIONS']);

const router = neru.Router();

// Init ----------------------------------------------

import AWS from 'aws-sdk';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import Vonage from '@vonage/server-sdk';

import { StartTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { TranscribeClient } from "@aws-sdk/client-transcribe";

const session = neru.getSessionById(`neru-voice-record-transcript-s3-${APP_ID}`);
const instanceState = session.getState();

let awsKey = `${APP_ID}:awsInfo`,
    awsInfo = await instanceState.get(awsKey);

var apiKey = process.env.API_ACCOUNT_ID,
    apiSecret = NERU_CONFIGURATIONS.apiSecret,
    privateKey = "./private.key",
    applicationId = process.env.API_APPLICATION_ID,
    awsId, awsSecret, awsRegion, s3Bucket,
    s3, transcribeClient, vonage;

const initFromAwsInfo = async() => {
    try {
        console.log("awsInfo", awsInfo);
        awsId = awsInfo.awsId;
        awsSecret = awsInfo.awsSecret;
        s3Bucket = awsInfo.s3Bucket;
        awsRegion = awsInfo.awsRegion;
        return { error: null, message: "Init from awsInfo" };
    } catch (error) {
        console.log("initFromAwsInfo - AWS data not found");
        return { error: true, message: "AWS data not found" };
    }
}
const initVonageSDK = async() => {
    vonage = new Vonage({
        apiKey, apiSecret, applicationId, privateKey
    }, {
        debug: true
    });
    console.log("Vonage SDK init")
    return "Ok";
}
const initAwsS3 = async() => {
    s3 = new AWS.S3({
        accessKeyId: awsId,
        secretAccessKey: awsSecret
    });
    console.log("AWS S3 init")
    return "Ok";
}
const initAwsTranscribe = async() => {
    transcribeClient = new TranscribeClient({
        region: awsRegion,
        credentials: new AWS.Credentials(awsId, awsSecret)
    });
    console.log("AWS Transcribe init")
    return "Ok";
}
const initData = async() => {
    try {
        let result = await initFromAwsInfo();
        if (!result.error) {
            await initVonageSDK();
            await initAwsS3();
            await initAwsTranscribe();
        }
    } catch (error) {
        console.error("initData - ", error);
    }
}
await initData();

// Admin authentication ------------------------------

import cel from "connect-ensure-login";
import cons from 'consolidate';
import cookieParser from "cookie-parser";
import e_session from "express-session";
import flash from "express-flash";
import LocalStrategy from "passport-local";
import passport from "passport";

router.use(cookieParser());
router.use(e_session({
    secret: 'siberian husky',
    resave: false,
    saveUninitialized: false,
}));
router.use(flash());
router.use(passport.authenticate('session'));

const ensureLoggedIn = cel.ensureLoggedIn;

passport.use(new LocalStrategy(function verify(appID, apiSecret, cb) {
    if (process.env["API_APPLICATION_ID"] != appID) {
        return cb(null, false, { message: 'Incorrect username or password.' });
    }
    
    const apiKey = process.env.API_ACCOUNT_ID;
    const vonage = new Vonage({
        apiKey, apiSecret
    });
    
    vonage.account.listSecrets(apiKey, (err, result) => {
        if (err) {
            return cb(null, false, { message: 'Incorrect username or password.' });
        }
        cb(null, { id: "0", username: "Vonage User" });
    });
}));

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
        cb(null, { id: user.id, username: user.username });
    });
});
passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
        return cb(null, user);
    });
});

router.get('/', function (req, res, next) {
    res.json({ up: "Neru Voice Record Transcript S3" });
});

router.get('/login', function (req, res, next) {
    let messages = req.flash("error");
    cons.ejs(path + "login.ejs", { messages }, function (err, html) {
        if (err) throw err;
        res.send(html);
    });
});

router.post('/login', passport.authenticate('local', {
    successReturnToOrRedirect: './config',
    failureRedirect: './login',
    failureFlash: true
}));

router.post('/logout', function (req, res, next) {
    req.logout();
    res.redirect('./login');
});

router.get('/logout', function (req, res, next) {
    req.logout();
    res.redirect('./');
});

// Config page ---------------------------------------

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import st from 'serve-static';

const __dirname = dirname(fileURLToPath(import.meta.url));
var path = __dirname + '/public/views/';

router.use("/css", st(join(__dirname, "public/css")));
router.use("/js", st(join(__dirname, "public/js")));

router.get('/config', ensureLoggedIn("./login"), async (req, res, next) => {
    res.sendFile(path + "config.html");
});

router.get('/config/get', async (req, res, next) => {
    try {
        res.json({
            apiKey: process.env.API_ACCOUNT_ID,
            applicationId: process.env.API_APPLICATION_ID,
            awsId, awsSecret, awsRegion, s3Bucket
        });
    } catch (error) {
        res.json({
            error: error.message ? error.message : error
        });
    }
});

router.post('/config/save', async (req, res, next) => {
    try {
        console.log("/config/save", req.body);
        let { awsId, awsSecret, s3Bucket, awsRegion } = req.body;

        if (!awsId || !awsSecret || !s3Bucket || !awsRegion) {
            throw(new Error("awsId, awsSecret, awsRegion, s3Bucket, are required"));
        }

        // Check aws credentials & if bucket exists
        const checkAwsCredsS3BucketFunction = Util.promisify(checkAwsCredsS3Bucket);
        await checkAwsCredsS3BucketFunction({
            awsId, awsSecret, awsRegion, s3Bucket
        });

        // Create s3 object
        s3 = new AWS.S3({
            accessKeyId: awsId,
            secretAccessKey: awsSecret
        });

        // Save aws credentials
        await instanceState.set(awsKey, {
            awsId, awsSecret, awsRegion, s3Bucket
        });

        // Create Vonage object, s3 object, aws transcribe object
        await initVonageSDK();
        await initAwsS3();
        await initAwsTranscribe();

        res.sendStatus(200);
    } catch (error) {
        res.send(error.message ? error.message : error);
    }
});

const checkAwsCredsS3Bucket = ({ awsId, awsSecret, awsRegion, s3Bucket }, callback) => {
    let checkS3 = new AWS.S3({
        accessKeyId: awsId,
        secretAccessKey: awsSecret,
        region: awsRegion
    });
    checkS3.listBuckets({}, (err, data) => {
        if (err) {
            return callback(err);
        }
        let bucketExists = false;
        data.Buckets.forEach((bucket) => {
            if (bucket.Name === s3Bucket) {
                bucketExists = true;
            }
        });
        if (!bucketExists) {
            return callback("Bucket doesn't exist!");
        }
        callback(null, "Ok");
    });
};

// Webhook events ------------------------------------
router.post('/webhooks/answer', async (req, res, next) => {
    console.log('/webhooks/answer ', req.body);

    try {
        if (!awsInfo) {
            throw(new Error("Unable to process event. Please setup AWS credentials in config page first."))
        }

        let eventUrl = `${BASE_URL}/${INSTANCE_SRV_NAME}/webhooks/recordings`;
        console.log("eventUrl", eventUrl);

        res.json([{
            action: 'talk',
            text: 'Hello. Your message will be recorded. Presh hash when you\'re done speaking.'
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
    // console.log('/webhooks/event ', req.body);
    res.sendStatus(200);
});

router.post('/webhooks/recordings', async (req, res, next) => {
    console.log('/webhooks/recordings ', req.body);
    
    try {
        if (!awsInfo) {
            throw(new Error("Unable to process event. Please setup AWS credentials in config page first."))
        }

        let { recording_url, recording_uuid, conversation_uuid } = req.body;

        // Download recording to server
        const saveRecordingFunction = Util.promisify(saveRecording);
        await saveRecordingFunction({
            recordingUrl: recording_url,
            filename: `recordings/${conversation_uuid}|${recording_uuid}.mp3`
        });
        
        // Upload to S3 bucket
        const uploadFileFunction = Util.promisify(uploadFile);
        let uploadFileResult = await uploadFileFunction({
            localFileName: `recordings/${conversation_uuid}|${recording_uuid}.mp3`,
            s3FileName: `${conversation_uuid}/${recording_uuid}.mp3`
        });
        let recordingUrl = uploadFileResult.Location;
        
        // Send to AWS Transcribe and upload to S3 bucket
        let jobName = uuidv4();
        await transcribeMp3({
            jobName,
            languageCode: "en-US",
            mediaFormat: "mp3",
            mediaUri: recordingUrl,
            outputKey: `${conversation_uuid}/${recording_uuid}.json`
        });

        // Delete recording file from server
        const deleteFileFunction = Util.promisify(deleteFile);
        await deleteFileFunction({
            localFileName: `recordings/${conversation_uuid}|${recording_uuid}.mp3`,
        });

        res.sendStatus(200);
    } catch (error) {
        console.error("/webhooks/recording - ", error);
        res.send(error.message ? error.message : error);
    }
});

const saveRecording = ({ recordingUrl, filename }, callback) => {
    vonage.files.save(recordingUrl, filename, callback);
}

const uploadFile = ({ localFileName, s3FileName }, callback) => {
    const fileContent = fs.readFileSync(localFileName);
    console.log(NERU_CONFIGURATIONS.awsId, NERU_CONFIGURATIONS.awsSecret, NERU_CONFIGURATIONS.s3Bucket, NERU_CONFIGURATIONS.awsSessionToken);
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
        console.log("Error - transcribeMp3", err);
    }
};

export { router };