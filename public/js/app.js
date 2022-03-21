function handleError(error) {
    console.log('handle error', error);
    if (error) {
        alert(error.message ? error.message : error);
    }
}

function onConfigGet(result) {
    console.log("/config/get | ", result);
    if (result.status === 200) {
        let {
            apiKey, applicationId, awsId, awsSecret, awsRegion, s3Bucket
        } = result.data;
        document.getElementById("apiKey").value = apiKey;
        document.getElementById("applicationId").value = applicationId;
        document.getElementById("awsId").value = awsId ? awsId : "";
        document.getElementById("awsSecret").value = awsSecret ? awsSecret : "";
        document.getElementById("awsRegion").value = awsRegion ? awsRegion : "";
        document.getElementById("s3Bucket").value = s3Bucket ? s3Bucket : "";
    } else {
        handleError(result);
    }
}

var path = window.location.pathname.replace("/config", "");
axios.get(`${path}/config/get`, {})
    .then(onConfigGet)
    .catch(handleError);