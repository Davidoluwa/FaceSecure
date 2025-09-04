importScripts('/FaceSecure/face-api.min.js');

self.onmessage = async (e) => {
    const imageData = e.data;

    if (!self.modelsLoaded) {
        try {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri('/FaceSecure/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/FaceSecure/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/FaceSecure/models')
            ]);
            self.modelsLoaded = true;
            console.log('Worker: Models loaded');
        } catch (error) {
            console.error('Worker: Error loading models:', error);
            self.postMessage(null);
            return;
        }
    }

    try {
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        const detections = await faceapi.detectSingleFace(imageData, options).withFaceLandmarks().withFaceDescriptor();
        console.log('Worker: Detection result:', detections);
        self.postMessage(detections);
    } catch (error) {
        console.error('Worker: Detection error:', error);
        self.postMessage(null);
    }
};
