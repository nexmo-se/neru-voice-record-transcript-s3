# neru-voice-record-transcript-s3
Neru App for Voice API recording and transcription (using AWS Transcribe) upload to Amazon S3 bucket.

## 📚 Preparation
- Create your Vonage application and connect it to Neru.
- Check `neru.yml.example` to see what configurations fields need to be added into `neru.yml`.
- Download your application's `private.key` from Vonage Dashboard and place it under the root folder.
- Make sure your LVN is linked to the Vonage application which you have linked to the Neru app.
- Run `npm install`.
- Deploy app to Neru using the `neru deploy` command.
- Make sure you have your AWS credentials (id key, secret, region) and S3 bucket name ready.

## ▶️ Executing
1. First, you need to login and save your AWS credentials & S3 bucket name in the application.
2. Nagivate to `/login` to access the config page. Use the Vonage application ID and your Vonage account's api secret to authenticate. You will then be redirected to the `/config` page.
3. Fill in all the four fields: "AWS Access Key ID", "AWS Secret Access Key", "AWS Region", "AWS S3 Bucket Name".
4. Click "Save" button. If your credentials are valid, the page will show 200.
5. Call into the number. Speak onto the microphone after the beep.
6. Go to your S3 bucket from your AWS S3 dashboard. There should be a folder inside titled with the Conversation UUID (`CON-xxxxx-xxxx-xxxx`).
7. If you go inside the folder, there should be two files, named after the Recording UUID (`xxxx-xxxx`). The `mp3` file is the actual recording file, while the `json` file is the transcription result.