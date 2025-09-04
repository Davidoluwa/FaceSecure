// faceWorker.js
self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js');
self.importScripts('/path/to/face-api.min.js'); // Adjust path to your face-api.min.js

let isLoaded = false;

self.onmessage = async function (e) {
    const { imageData, type, minConfidence, inputSize } = e.data;

    if (type === 'loadModels') {
        if (!isLoaded) {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/FaceSecure/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/FaceSecure/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/FaceSecure/models')
            ]);
            isLoaded = true;
        }
        self.postMessage({ type: 'modelsLoaded' });
        return;
    }

    if (type === 'detectFace') {
        try {
            const detections = await faceapi
                .detectSingleFace(imageData, new faceapi.TinyFaceDetectorOptions({ inputSize, minConfidence }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            self.postMessage({ type: 'detectionResult', detections });
        } catch (error) {
            self.postMessage({ type: 'detectionError', error: error.message });
        }
    }
};
