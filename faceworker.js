importScripts('/FaceSecure/face-api.min.js');

self.onmessage = async (e) => {
    const imageData = e.data;

    if (!self.modelsLoaded) {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/FaceSecure/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/FaceSecure/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/FaceSecure/models');
        self.modelsLoaded = true;
    }

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.4 });
    const detections = await faceapi.detectSingleFace(imageData, options).withFaceLandmarks().withFaceDescriptor();

    self.postMessage(detections);
};
