# neru-voice-record-transcript-s3
Neru App for Voice API recording and transcription (using AWS Transcribe) upload to Amazon S3 bucket.

## 📚 Preparation
1. Create your Vonage application and connect it to Neru app. See [how to create Neru applications here](https://vonage-neru.herokuapp.com/neru/getting-started) (you only need to enable Voice).
2. Make sure your LVN is linked to the Vonage application.
3. Download your application's `private.key` from Vonage Dashboard and place it under the root folder.
4. Make sure your Vonage application's Voice Answer URL and Event URL is pointing to your Neru app:
    - `{host}/webhooks/answer`
    - `{host}/webhooks/event`
5. Check `neru.yml.example` to see what configurations fields need to be added into `neru.yml`.
6. Run `npm install`.
7. Deploy app to Neru using the `neru deploy` command. Use the second url given by Neru upon successfully running this command.
8. Make sure you have your AWS credentials (id key, secret, region) and S3 bucket name ready with the correct permissions.

## ▶️ Executing
1. First, you need to login and save your AWS credentials & S3 bucket name in the application.
2. Nagivate to `/login` to access the config page. Use your Vonage application ID and your Vonage account's api secret to authenticate. You will then be redirected to the `/config` page.
3. Fill in all the four fields: "AWS Access Key ID", "AWS Secret Access Key", "AWS Region", "AWS S3 Bucket Name".
4. Click "Save" button. If your credentials are valid, the page will show `OK`.
5. Call the LVN you connected to the Vonage application. Speak onto the microphone after the beep. Press hash to end the call.
6. Go to your S3 bucket from your AWS S3 dashboard. There should be a folder inside titled with the Conversation UUID (`CON-12345678-1234-1234-1234-123456789012/`).
7. If you go inside the folder, there should be two files, named after the Recording UUID (`87654321-4321-4321-4321-098765432109`). The `mp3` file is the actual recording file, while the `json` file is the transcription result.