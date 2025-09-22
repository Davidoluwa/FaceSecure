// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore, collection, getDocs, setDoc, doc, updateDoc, deleteDoc, query, where, arrayUnion } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDzJv667X-NcmeXtzysHaVOfUexhzEgiFY",
    authDomain: "facedb-45e9c.firebaseapp.com",
    projectId: "facedb-45e9c",
    storageBucket: "facedb-45e9c.firebasestorage.app",
    messagingSenderId: "537182009611",
    appId: "1:537182009611:web:65291f0f3dff933435ca0e",
    measurementId: "G-6BGYEE8QF1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

const loadingScreen = document.getElementById('loading-screen');

// Load face-api.js models
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/FaceSecure/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/FaceSecure/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/FaceSecure/models'),
    faceapi.nets.mtcnn.loadFromUri('/FaceSecure/models') // Added MTCNN for robust detection
]).then(() => {
    loadingScreen.classList.add('hidden');
    start();
});

const video = document.getElementById('video');
const attendanceVideo = document.getElementById('attendance-video');
const canvas = document.getElementById('canvas');
const fullNameInput = document.getElementById('full-name');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const switchBtn = document.getElementById('switch-btn');
const authTitle = document.getElementById('auth-title');
const statusDisplay = document.getElementById('status');
const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const roomNameInput = document.getElementById('room-name');
const attendanceCapInput = document.getElementById('attendance-cap');
const closeTimeInput = document.getElementById('close-time');
const closeDeadlineInput = document.getElementById('close-deadline');
const createRoomStatus = document.getElementById('create-room-status');
const roomCodeInput = document.getElementById('room-code');
const markAttendanceBtn = document.getElementById('mark-attendance-btn');
const stopPresenceBtn = document.getElementById('stop-presence-btn');
const attendRoomStatus = document.getElementById('attend-room-status');
const recognizedUserDisplay = document.getElementById('recognized-user');
const openRoomsList = document.getElementById('open-rooms-list');
const historyRoomsList = document.getElementById('history-rooms-list');
const presenceCamera = document.getElementById('presence-camera');
const togglePrefix = document.getElementById('toggle-prefix');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const currentTabButton = document.getElementById('current-tab');
const currentTabName = document.getElementById('current-tab-name');
const currentModeDisplay = document.getElementById('current-mode');
const dropdownIndicator = document.getElementById('dropdown-indicator');
const attendanceModeDropdown = document.getElementById('attendance-mode-dropdown');
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
let isRegisterMode = true;
let currentUser = null;
let presenceInterval = null;
let currentPresenceRoom = null;
let currentTab = 'create-room';
let createRoomMode = 'online';
let searchQuery = '';
let stream = null;
const faceMatchThreshold = 0.45; // Stricter threshold for better differentiation
const minFaceSize = 100; // Minimum face size in pixels
const maxDescriptors = 5; // Number of descriptors to capture
const descriptorCache = new Map(); // Cache for user descriptors

// Create sidebar overlay
const sidebarOverlay = document.querySelector('.sidebar-overlay');

// Helper function to preprocess image
async function preprocessImage(videoElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Normalize brightness and contrast
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        min = Math.min(min, brightness);
        max = Math.max(max, brightness);
    }
    for (let i = 0; i < data.length; i += 4) {
        data[i] = ((data[i] - min) / (max - min)) * 255;
        data[i + 1] = ((data[i + 1] - min) / (max - min)) * 255;
        data[i + 2] = ((data[i + 2] - min) / (max - min)) * 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// Helper function to check face quality
async function checkFaceQuality(detections) {
    if (!detections || !detections.detection) return false;
    const { score, box } = detections.detection;
    const faceSize = Math.min(box.width, box.height);
    return score > 0.9 && faceSize > minFaceSize; // Ensure high confidence and sufficient face size
}

// Enhanced face matching with weighted average
function isFaceMatch(queryDescriptor, userDescriptors) {
    if (!userDescriptors || userDescriptors.length === 0) return false;
    const distances = userDescriptors.map(ud => 
        faceapi.euclideanDistance(queryDescriptor, new Float32Array(Object.values(ud)))
    );
    const avgDistance = distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    return avgDistance < faceMatchThreshold;
}

// Cache user descriptors
async function loadUserDescriptors() {
    if (descriptorCache.size > 0) return;
    const usersSnapshot = await getDocs(collection(db, 'users'));
    usersSnapshot.forEach(doc => {
        const user = doc.data();
        descriptorCache.set(user.fullName, user.descriptors || [user.descriptor]);
    });
}

// Start camera
async function startCamera() {
    if (stream) return true;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720, frameRate: 30 } // Higher resolution for better accuracy
        });
        video.srcObject = stream;
        attendanceVideo.srcObject = stream;
        return true;
    } catch (err) {
        statusDisplay.textContent = 'Camera permission denied. Please allow camera access.';
        console.error('Error accessing camera:', err);
        return false;
    }
}

// Stop camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        attendanceVideo.srcObject = null;
    }
}

// Update Create Room form
function updateCreateRoomForm() {
    attendanceCapInput.style.display = createRoomMode === 'online' ? 'block' : 'none';
    closeTimeInput.style.display = createRoomMode === 'online' ? 'block' : 'none';
    closeDeadlineInput.style.display = createRoomMode === 'online' ? 'block' : 'none';
    createRoomStatus.textContent = '';
}

// Update Attend Room tab UI
function updateAttendRoomTab() {
    roomCodeInput.style.display = 'block';
    markAttendanceBtn.style.display = 'block';
    presenceCamera.style.display = 'none';
    attendRoomStatus.textContent = '';
    recognizedUserDisplay.textContent = '';
    stopCamera();
}

// Update header tab display
function updateTabDisplay(tabId) {
    currentTab = tabId;
    const tabNames = {
        'create-room': 'Create Room',
        'attend-room': 'Attend Room',
        'view-rooms': 'Opened Rooms',
        'rooms-history': 'Rooms History'
    };
    currentTabName.textContent = tabNames[tabId] || 'Unknown';
    currentModeDisplay.style.display = tabId === 'create-room' ? 'inline' : 'none';
    currentModeDisplay.textContent = tabId === 'create-room' ? `(${createRoomMode.charAt(0).toUpperCase() + createRoomMode.slice(1)})` : '';
    dropdownIndicator.style.display = tabId === 'create-room' ? 'inline' : 'none';
    searchBtn.style.display = (tabId === 'view-rooms' || tabId === 'rooms-history') ? 'inline-block' : 'none';
    searchInput.style.display = 'none';
    searchQuery = '';
    attendanceModeDropdown.style.display = 'none';
    updateDropdownTicks();
    if (tabId !== 'attend-room' && tabId !== 'create-room') {
        stopCamera();
    }
}

// Update dropdown tick visibility
function updateDropdownTicks() {
    document.querySelectorAll('.tick').forEach(tick => {
        tick.style.display = tick.dataset.mode === createRoomMode ? 'inline' : 'none';
    });
}

// Handle dropdown toggle
currentTabButton.addEventListener('click', () => {
    if (currentTab === 'create-room') {
        attendanceModeDropdown.style.display = attendanceModeDropdown.style.display === 'none' ? 'flex' : 'none';
    }
});

// Handle dropdown item selection
document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
        createRoomMode = item.dataset.mode;
        updateCreateRoomForm();
        updateTabDisplay(currentTab);
        attendanceModeDropdown.style.display = 'none';
    });
});

// Handle search button toggle
searchBtn.addEventListener('click', () => {
    searchInput.style.display = searchInput.style.display === 'none' ? 'inline-block' : 'none';
    if (searchInput.style.display === 'inline-block') {
        searchInput.focus();
    } else {
        searchQuery = '';
        searchInput.value = '';
        if (currentTab === 'view-rooms') {
            displayOpenRooms();
        } else if (currentTab === 'rooms-history') {
            displayRoomsHistory();
        }
    }
});

// Handle search input
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    if (currentTab === 'view-rooms') {
        displayOpenRooms();
    } else if (currentTab === 'rooms-history') {
        displayRoomsHistory();
    }
});

async function start() {
    // Set initial state for login/register mode
    fullNameInput.style.display = isRegisterMode ? 'block' : 'none';
    authTitle.textContent = isRegisterMode ? 'Register Your Face' : 'Login';
    registerBtn.style.display = isRegisterMode ? 'inline' : 'none';
    loginBtn.style.display = isRegisterMode ? 'none' : 'inline';
    switchBtn.textContent = isRegisterMode ? 'Login' : 'Register';
    togglePrefix.textContent = isRegisterMode ? 'Already registered? ' : 'Need an account? ';
    updateCreateRoomForm();
    updateTabDisplay('create-room');

    // Preload user descriptors
    await loadUserDescriptors();
    
    // Start camera for auth screen
    await startCamera();
    
    // Handle register/login mode switch
    switchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isRegisterMode = !isRegisterMode;
        authTitle.textContent = isRegisterMode ? 'Register Your Face' : 'Login';
        registerBtn.style.display = isRegisterMode ? 'inline' : 'none';
        loginBtn.style.display = isRegisterMode ? 'none' : 'inline';
        switchBtn.textContent = isRegisterMode ? 'Login' : 'Register';
        togglePrefix.textContent = isRegisterMode ? 'Already registered? ' : 'Need an account? ';
        fullNameInput.style.display = isRegisterMode ? 'block' : 'none';
        fullNameInput.value = '';
        statusDisplay.textContent = '';
    });

    // Register button event
    registerBtn.addEventListener('click', async () => {
        registerBtn.classList.add('active');
        if (!stream) await startCamera();
        const fullName = fullNameInput.value.trim();
        if (!fullName || fullName.split(' ').length < 2) {
            statusDisplay.textContent = 'Please enter a full name with at least two names';
            registerBtn.classList.remove('active');
            return;
        }

        loadingScreen.classList.remove('hidden');
        registerBtn.classList.remove('active');
        
        try {
            // Check if user already exists
            const userDoc = await getDocs(query(collection(db, 'users'), where('fullName', '==', fullName)));
            if (!userDoc.empty) {
                statusDisplay.textContent = 'User with this name already exists.';
                loadingScreen.classList.add('hidden');
                return;
            }

            // Capture multiple descriptors with guidance
            const descriptors = [];
            const angles = ['center', 'left', 'right', 'up', 'down'];
            for (let i = 0; i < maxDescriptors; i++) {
                statusDisplay.textContent = `Capturing face ${i + 1}/${maxDescriptors} (${angles[i]}). Please face ${angles[i]}.`;
                const preprocessed = await preprocessImage(video);
                const detections = await faceapi
                    .detectSingleFace(preprocessed, new faceapi.SsdMobilenetv1Options())
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (!detections || !await checkFaceQuality(detections)) {
                    statusDisplay.textContent = `No clear face detected for ${angles[i]}. Please align your face and try again.`;
                    loadingScreen.classList.add('hidden');
                    return;
                }
                descriptors.push(Array.from(detections.descriptor));
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // Check for duplicate face descriptors
            let isDuplicate = false;
            for (const [existingName, userDescriptors] of descriptorCache) {
                if (existingName === fullName) continue;
                for (const newDesc of descriptors) {
                    if (isFaceMatch(new Float32Array(newDesc), userDescriptors)) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (isDuplicate) break;
            }
            if (isDuplicate) {
                statusDisplay.textContent = 'This face is too similar to an existing user.';
                loadingScreen.classList.add('hidden');
                return;
            }

            // Register new user
            await setDoc(doc(db, 'users', fullName), {
                fullName,
                descriptors
            });
            descriptorCache.set(fullName, descriptors);
            statusDisplay.textContent = 'Registration successful! Please login.';
            isRegisterMode = false;
            authTitle.textContent = 'Login';
            registerBtn.style.display = 'none';
            loginBtn.style.display = 'inline';
            switchBtn.textContent = 'Register';
            togglePrefix.textContent = 'Need an account? ';
            fullNameInput.style.display = 'none';
            fullNameInput.value = '';
        } catch (error) {
            console.error('Error registering user:', error);
            statusDisplay.textContent = 'Error registering user. Please try again.';
        } finally {
            loadingScreen.classList.add('hidden');
        }
    });

    // Login button event with multi-frame analysis
    loginBtn.addEventListener('click', async () => {
        loginBtn.classList.add('active');
        if (!stream) await startCamera();
        loadingScreen.classList.remove('hidden');
        loginBtn.classList.remove('active');
        
        try {
            const frameDescriptors = [];
            const frameCount = 3; // Analyze 3 frames for consistency
            for (let i = 0; i < frameCount; i++) {
                statusDisplay.textContent = `Scanning face ${i + 1}/${frameCount}...`;
                const preprocessed = await preprocessImage(video);
                const detections = await faceapi
                    .detectSingleFace(preprocessed, new faceapi.SsdMobilenetv1Options())
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (!detections || !await checkFaceQuality(detections)) {
                    statusDisplay.textContent = `No clear face detected in frame ${i + 1}. Please align your face.`;
                    loadingScreen.classList.add('hidden');
                    return;
                }
                frameDescriptors.push(detections.descriptor);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Average descriptors for stability
            const avgDescriptor = new Float32Array(128);
            for (let i = 0; i < 128; i++) {
                avgDescriptor[i] = frameDescriptors.reduce((sum, desc) => sum + desc[i], 0) / frameCount;
            }

            let matchedUser = null;
            let minDistance = Infinity;
            for (const [fullName, userDescriptors] of descriptorCache) {
                const distance = userDescriptors.reduce((sum, ud) => 
                    sum + faceapi.euclideanDistance(avgDescriptor, new Float32Array(Object.values(ud))), 0) / userDescriptors.length;
                if (distance < faceMatchThreshold && distance < minDistance) {
                    minDistance = distance;
                    matchedUser = { fullName, descriptors: userDescriptors };
                }
            }

            if (matchedUser) {
                statusDisplay.textContent = 'Login successful!';
                currentUser = matchedUser.fullName;
                showDashboard(matchedUser.fullName);
            } else {
                statusDisplay.textContent = 'Face not recognized. Please try again.';
            }
        } catch (error) {
            console.error('Error logging in:', error);
            statusDisplay.textContent = 'Error logging in. Please try again.';
        } finally {
            loadingScreen.classList.add('hidden');
        }
    });

    // Logout button event
    logoutBtn.addEventListener('click', () => {
        dashboard.style.display = 'none';
        document.querySelector('.auth-container').style.display = 'flex';
        fullNameInput.value = '';
        statusDisplay.textContent = '';
        currentUser = null;
        stopPresenceAttendance();
        isRegisterMode = true;
        authTitle.textContent = 'Register Your Face';
        registerBtn.style.display = 'inline';
        loginBtn.style.display = 'none';
        switchBtn.textContent = 'Login';
        togglePrefix.textContent = 'Already registered? ';
        fullNameInput.style.display = 'block';
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        currentTab = 'create-room';
        createRoomMode = 'online';
        searchQuery = '';
        searchInput.value = '';
        searchInput.style.display = 'none';
        updateTabDisplay('create-room');
        updateCreateRoomForm();
        startCamera();
    });

    // Back button event for attendance screen
    document.getElementById('back-btn').addEventListener('click', () => {
        const attendanceScreen = document.getElementById('attendance-screen');
        attendanceScreen.classList.remove('active');
        attendanceScreen.style.display = 'none';
        dashboard.style.display = 'flex';
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(currentTab).classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${currentTab}"]`).classList.add('active');
        updateTabDisplay(currentTab);
        if (currentTab === 'view-rooms') {
            displayOpenRooms();
        } else if (currentTab === 'rooms-history') {
            displayRoomsHistory();
        }
        stopCamera();
    });

    // Sidebar toggle
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        attendanceModeDropdown.style.display = 'none';
        searchInput.style.display = 'none';
        searchQuery = '';
        searchInput.value = '';
        if (currentTab === 'view-rooms') {
            displayOpenRooms();
        } else if (currentTab === 'rooms-history') {
            displayRoomsHistory();
        }
        stopCamera();
    });

    // Close sidebar when overlay is clicked
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        attendanceModeDropdown.style.display = 'none';
        searchInput.style.display = 'none';
        searchQuery = '';
        searchInput.value = '';
        if (currentTab === 'view-rooms') {
            displayOpenRooms();
        } else if (currentTab === 'rooms-history') {
            displayRoomsHistory();
        }
        stopCamera();
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            stopPresenceAttendance();
            searchQuery = '';
            searchInput.value = '';
            searchInput.style.display = 'none';
            updateTabDisplay(button.dataset.tab);
            if (button.dataset.tab === 'view-rooms') {
                displayOpenRooms();
            } else if (button.dataset.tab === 'rooms-history') {
                displayRoomsHistory();
            } else if (button.dataset.tab === 'attend-room') {
                updateAttendRoomTab();
            } else if (button.dataset.tab === 'create-room') {
                updateCreateRoomForm();
            }
        });
    });

    // Create room event
    createRoomBtn.addEventListener('click', async () => {
        const roomName = roomNameInput.value.trim();
        const attendanceCap = createRoomMode === 'online' ? parseInt(attendanceCapInput.value) || null : null;
        const closeTime = createRoomMode === 'online' ? (closeTimeInput.value ? parseInt(closeTimeInput.value) * 60 * 1000 : null) : null;
        const closeDeadline = createRoomMode === 'online' ? (closeDeadlineInput.value ? new Date(closeDeadlineInput.value).getTime() : null) : null;
        const attendanceMode = createRoomMode;

        if (!roomName) {
            createRoomStatus.textContent = 'Please enter a room name';
            return;
        }

        try {
            const roomDoc = await getDocs(query(collection(db, 'rooms'), where('name', '==', roomName), where('status', '==', 'open')));
            if (!roomDoc.empty) {
                createRoomStatus.textContent = 'Room name already exists';
                return;
            }

            const roomCode = attendanceMode === 'online' ? generateRoomCode() : null;
            const room = {
                name: roomName,
                attendanceCap,
                closeTime,
                closeDeadline,
                mode: attendanceMode,
                code: roomCode,
                status: 'open',
                creator: currentUser,
                createdAt: new Date().toISOString(),
                attendees: []
            };

            await setDoc(doc(db, 'rooms', roomName), room);
            if (closeTime) {
                setTimeout(() => closeRoom(roomName), closeTime);
            }
            createRoomStatus.textContent = `Room created successfully! ${roomCode ? `Code: ${roomCode}` : ''}`;
            roomNameInput.value = '';
            attendanceCapInput.value = '';
            closeTimeInput.value = '';
            closeDeadlineInput.value = '';

            if (attendanceMode === 'presence') {
                currentPresenceRoom = roomName;
                startPresenceAttendance(roomName);
            }
        } catch (error) {
            console.error('Error creating room:', error);
            createRoomStatus.textContent = 'Error creating room. Please try again.';
        }
    });

    // Mark attendance event (online mode)
    markAttendanceBtn.addEventListener('click', async () => {
        const roomCode = roomCodeInput.value.trim();
        if (!currentUser) {
            attendRoomStatus.textContent = 'You must be logged in to mark attendance.';
            return;
        }
        if (!roomCode) {
            attendRoomStatus.textContent = 'Please enter a room code.';
            return;
        }

        try {
            const roomsSnapshot = await getDocs(query(collection(db, 'rooms'), where('code', '==', roomCode), where('status', '==', 'open')));
            if (roomsSnapshot.empty) {
                attendRoomStatus.textContent = 'Invalid or closed room code';
                return;
            }

            const roomDoc = roomsSnapshot.docs[0];
            const room = roomDoc.data();

            if (room.attendanceCap && room.attendees.length >= room.attendanceCap) {
                attendRoomStatus.textContent = 'Attendance cap reached';
                return;
            }

            const userDoc = await getDocs(query(collection(db, 'users'), where('fullName', '==', currentUser)));
            if (userDoc.empty) {
                attendRoomStatus.textContent = 'User not found. Please re-login.';
                return;
            }

            if (room.attendees.includes(currentUser)) {
                attendRoomStatus.textContent = 'You have already marked attendance for this room';
                return;
            }

            await updateDoc(doc(db, 'rooms', room.name), {
                attendees: arrayUnion(currentUser)
            });
            attendRoomStatus.textContent = 'Attendance marked successfully!';
            roomCodeInput.value = '';
        } catch (error) {
            console.error('Error marking attendance:', error);
            attendRoomStatus.textContent = 'Error marking attendance. Please try again.';
        }
    });

    // Stop presence attendance
    stopPresenceBtn.addEventListener('click', () => {
        stopPresenceAttendance();
    });

    // Set Create Room as default tab
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelector('.tab-btn[data-tab="create-room"]').classList.add('active');
        document.getElementById('create-room').classList.add('active');
        updateTabDisplay('create-room');
        updateCreateRoomForm();
    });
}

function showDashboard(fullName) {
    document.querySelector('.auth-container').style.display = 'none';
    dashboard.style.display = 'flex';
    currentUser = fullName;
    
    // Add Welcome message
    const createRoomTab = document.getElementById('create-room');
    const welcomeDiv = document.createElement('h2');
    welcomeDiv.id = 'welcome-message';
    welcomeDiv.textContent = `Welcome ${fullName.split(' ')[0]}`;
    const existingWelcome = createRoomTab.querySelector('#welcome-message');
    if (existingWelcome) existingWelcome.remove();
    createRoomTab.insertBefore(welcomeDiv, createRoomTab.querySelector('h3'));
    
    updateTabDisplay('create-room');
    updateCreateRoomForm();
    stopCamera();
}

async function displayOpenRooms() {
    try {
        if (!currentUser) {
            openRoomsList.innerHTML = '<p>Please log in to view rooms.</p>';
            return;
        }

        let q = query(
            collection(db, 'rooms'),
            where('status', '==', 'open'),
            where('creator', '==', currentUser)
        );
        const roomsSnapshot = await getDocs(q);
        let openRooms = roomsSnapshot.docs.map(doc => doc.data());

        if (searchQuery) {
            openRooms = openRooms.filter(room => room.name.toLowerCase().includes(searchQuery));
        }

        openRooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        openRoomsList.innerHTML = '';
        if (openRooms.length === 0) {
            openRoomsList.innerHTML = '<p>No open rooms available.</p>';
            return;
        }

        const header = document.createElement('div');
        header.classList.add('rooms-header');
        header.innerHTML = `
            <span>Name</span>
            <span>Created by</span>
            <span>Created at</span>
            <span>Mode</span>
            <span>Code</span>
            <span>Actions</span>
        `;
        openRoomsList.appendChild(header);

        openRooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.classList.add('room-item');
            roomDiv.innerHTML = `
                <span>${room.name}</span>
                <span>${room.creator}</span>
                <span>${new Date(room.createdAt).toLocaleString()}</span>
                <span>${room.mode}</span>
                <span>${room.code || '-'}</span>
                <div class="room-actions">
                    <button class="view-attendees-btn" data-room="${room.name}">View Attendees</button>
                    <button class="close-room-btn" data-room="${room.name}">Close Room</button>
                    <button class="delete-room-btn" data-room="${room.name}">Delete Room</button>
                    <button class="customize-rules-btn" data-room="${room.name}">Customize Rules</button>
                </div>
            `;
            openRoomsList.appendChild(roomDiv);
        });

        document.querySelectorAll('.view-attendees-btn').forEach(btn => {
            btn.addEventListener('click', () => viewAttendees(btn.dataset.room));
        });
        document.querySelectorAll('.close-room-btn').forEach(btn => {
            btn.addEventListener('click', () => closeRoom(btn.dataset.room));
        });
        document.querySelectorAll('.delete-room-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteRoom(btn.dataset.room));
        });
        document.querySelectorAll('.customize-rules-btn').forEach(btn => {
            btn.addEventListener('click', () => customizeRules(btn.dataset.room));
        });
    } catch (error) {
        console.error('Error fetching open rooms:', error);
        openRoomsList.innerHTML = '<p>Error loading rooms. Please try again.</p>';
    }
}

async function displayRoomsHistory() {
    try {
        if (!currentUser) {
            historyRoomsList.innerHTML = '<p>Please log in to view rooms.</p>';
            return;
        }

        const createdQuery = query(collection(db, 'rooms'), where('creator', '==', currentUser));
        const attendedQuery = query(collection(db, 'rooms'), where('attendees', 'array-contains', currentUser));
        const [createdSnapshot, attendedSnapshot] = await Promise.all([getDocs(createdQuery), getDocs(attendedQuery)]);

        const userRoomsMap = new Map();
        createdSnapshot.forEach(doc => userRoomsMap.set(doc.id, doc.data()));
        attendedSnapshot.forEach(doc => userRoomsMap.set(doc.id, doc.data()));

        let userRooms = Array.from(userRoomsMap.values());

        if (searchQuery) {
            userRooms = userRooms.filter(room => room.name.toLowerCase().includes(searchQuery));
        }

        userRooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        historyRoomsList.innerHTML = '';
        if (userRooms.length === 0) {
            historyRoomsList.innerHTML = '<p>No rooms in history.</p>';
            return;
        }

        const header = document.createElement('div');
        header.classList.add('rooms-header');
        header.innerHTML = `
            <span>Name</span>
            <span>Created by</span>
            <span>Created at</span>
            <span>Status</span>
            <span>Mode</span>
            <span>Code</span>
            <span>Attendance</span>
        `;
        historyRoomsList.appendChild(header);

        userRooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.classList.add('room-item');
            const isCreator = room.creator === currentUser;
            roomDiv.innerHTML = `
                <span>${room.name}</span>
                <span>${room.creator}</span>
                <span>${new Date(room.createdAt).toLocaleString()}</span>
                <span>${room.status}</span>
                <span>${room.mode}</span>
                <span>${room.code || '-'}</span>
                <span>${isCreator ? '-' : (room.attendees.includes(currentUser) ? 'Attended' : 'Not attended')}</span>
                ${isCreator ? `
                    <div class="room-actions">
                        <button class="view-attendees-btn" data-room="${room.name}">View Attendees</button>
                        <button class="delete-room-btn" data-room="${room.name}">Delete Room</button>
                    </div>
                ` : `
                    <div class="room-actions">
                        <button class="view-attendees-btn" data-room="${room.name}" disabled>View Attendees</button>
                    </div>
                `}
            `;
            historyRoomsList.appendChild(roomDiv);
        });

        document.querySelectorAll('.view-attendees-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => viewAttendees(btn.dataset.room));
        });
        document.querySelectorAll('.delete-room-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteRoom(btn.dataset.room));
        });
    } catch (error) {
        console.error('Error fetching rooms history:', error);
        historyRoomsList.innerHTML = '<p>Error loading history. Please try again.</p>';
    }
}

async function viewAttendees(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        const attendanceScreen = document.getElementById('attendance-screen');
        const attendeesTable = document.getElementById('attendees-list');
        const roomNameHeader = document.getElementById('attendance-room-name');

        if (!roomDoc.exists()) {
            attendeesTable.innerHTML = `
                <tr class="no-attendees"><td colspan="2">Room not found.</td></tr>
            `;
            roomNameHeader.textContent = 'Error';
            dashboard.style.display = 'none';
            attendanceScreen.classList.add('active');
            attendanceScreen.style.display = 'flex';
            return;
        }

        const room = roomDoc.data();
        if (room.creator !== currentUser) {
            attendeesTable.innerHTML = `
                <tr class="no-attendees"><td colspan="2">You are not authorized to view attendees.</td></tr>
            `;
            roomNameHeader.textContent = 'Unauthorized';
            dashboard.style.display = 'none';
            attendanceScreen.classList.add('active');
            attendanceScreen.style.display = 'flex';
            return;
        }

        dashboard.style.display = 'none';
        attendanceScreen.classList.add('active');
        attendanceScreen.style.display = 'flex';
        roomNameHeader.textContent = `${room.name} Attendance List`;

        if (room.attendees.length > 0) {
            attendeesTable.innerHTML = `
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Name</th>
                    </tr>
                </thead>
                <tbody>
                    ${room.attendees.map((name, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${name}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
        } else {
            attendeesTable.innerHTML = `
                <tr class="no-attendees"><td colspan="2">No attendees yet.</td></tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching attendees:', error);
        const attendeesTable = document.getElementById('attendees-list');
        attendeesTable.innerHTML = `
            <tr class="no-attendees"><td colspan="2">Error loading attendees.</td></tr>
        `;
        document.getElementById('attendance-room-name').textContent = 'Error';
    }
}

async function closeRoom(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        if (roomDoc.exists() && roomDoc.data().status === 'open' && roomDoc.data().creator === currentUser) {
            await updateDoc(doc(db, 'rooms', roomName), { status: 'closed' });
            stopPresenceAttendance();
            displayOpenRooms();
            displayRoomsHistory();
        }
    } catch (error) {
        console.error('Error closing room:', error);
    }
}

async function deleteRoom(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        if (roomDoc.exists() && roomDoc.data().creator === currentUser) {
            await deleteDoc(doc(db, 'rooms', roomName));
            stopPresenceAttendance();
            displayOpenRooms();
            displayRoomsHistory();
        }
    } catch (error) {
        console.error('Error deleting room:', error);
    }
}

async function customizeRules(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        if (!roomDoc.exists() || roomDoc.data().status !== 'open' || roomDoc.data().creator !== currentUser) return;
        const room = roomDoc.data();

        const newCap = prompt('Enter new attendance cap (leave blank for no cap):', room.attendanceCap || '');
        const newCloseTime = prompt('Enter new auto-close time in minutes (leave blank for none):', room.closeTime ? room.closeTime / 60000 : '');
        const newDeadline = prompt('Enter new close Otisclose deadline (YYYY-MM-DDTHH:MM, leave blank for none):', room.closeDeadline ? new Date(room.closeDeadline).toISOString().slice(0, 16) : '');

        const updates = {};
        if (newCap !== null) updates.attendanceCap = newCap ? parseInt(newCap) : null;
        if (newCloseTime !== null) updates.closeTime = newCloseTime ? parseInt(newCloseTime) * 60 * 1000 : null;
        if (newDeadline !== null) updates.closeDeadline = newDeadline ? new Date(newDeadline).getTime() : null;

        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'rooms', roomName), updates);
            if (updates.closeTime) {
                setTimeout(() => closeRoom(roomName), updates.closeTime);
            }
            displayOpenRooms();
        }
    } catch (error) {
        console.error('Error customizing rules:', error);
    }
}

function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

async function startPresenceAttendance(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        if (!roomDoc.exists() || roomDoc.data().status !== 'open' || roomDoc.data().mode !== 'presence' || roomDoc.data().creator !== currentUser) {
            console.log('Presence room not found, not open, or not authorized:', roomName);
            return;
        }

        if (!stream) await startCamera();

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="attend-room"]').classList.add('active');
        document.getElementById('attend-room').classList.add('active');
        updateTabDisplay('attend-room');
        presenceCamera.style.display = 'flex';
        roomCodeInput.style.display = 'block';
        markAttendanceBtn.style.display = 'block';
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');

        presenceInterval = setInterval(async () => {
            const roomDoc = await getDoc(doc(db, 'rooms', roomName));
            if (!roomDoc.exists()) {
                stopPresenceAttendance();
                return;
            }
            const room = roomDoc.data();
            if (room.status !== 'open' || (room.attendanceCap && room.attendees.length >= room.attendanceCap)) {
                stopPresenceAttendance();
                return;
            }

            const preprocessed = await preprocessImage(attendanceVideo);
            const detections = await faceapi
                .detectSingleFace(preprocessed, new faceapi.SsdMobilenetv1Options())
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!detections || !await checkFaceQuality(detections)) {
                recognizedUserDisplay.textContent = 'No clear face detected. Please align your face.';
                return;
            }

            const frameDescriptors = [detections.descriptor];
            for (let i = 0; i < 2; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const newDetections = await faceapi
                    .detectSingleFace(attendanceVideo, new faceapi.SsdMobilenetv1Options())
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (newDetections && await checkFaceQuality(newDetections)) {
                    frameDescriptors.push(newDetections.descriptor);
                }
            }

            const avgDescriptor = new Float32Array(128);
            for (let i = 0; i < 128; i++) {
                avgDescriptor[i] = frameDescriptors.reduce((sum, desc) => sum + desc[i], 0) / frameDescriptors.length;
            }

            let matchedUser = null;
            let minDistance = Infinity;
            for (const [fullName, userDescriptors] of descriptorCache) {
                const distance = userDescriptors.reduce((sum, ud) => 
                    sum + faceapi.euclideanDistance(avgDescriptor, new Float32Array(Object.values(ud))), 0) / userDescriptors.length;
                if (distance < faceMatchThreshold && distance < minDistance) {
                    minDistance = distance;
                    matchedUser = { fullName, descriptors: userDescriptors };
                }
            }

            if (!matchedUser) {
                recognizedUserDisplay.textContent = 'Face not recognized. Please try again.';
                return;
            }

            if (room.attendees.includes(matchedUser.fullName)) {
                recognizedUserDisplay.textContent = `${matchedUser.fullName} has already marked attendance.`;
                return;
            }

            await updateDoc(doc(db, 'rooms', roomName), {
                attendees: arrayUnion(matchedUser.fullName)
            });
            recognizedUserDisplay.textContent = `Recognized: ${matchedUser.fullName}`;
            setTimeout(() => {
                if (recognizedUserDisplay.textContent === `Recognized: ${matchedUser.fullName}`) {
                    recognizedUserDisplay.textContent = '';
                }
            }, 3000);
        }, 3000);
    } catch (error) {
        console.error('Error starting presence attendance:', error);
        recognizedUserDisplay.textContent = 'Error starting presence attendance.';
        stopCamera();
    }
}

function stopPresenceAttendance() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
    if (currentPresenceRoom) {
        closeRoom(currentPresenceRoom);
        currentPresenceRoom = null;
    }
    presenceCamera.style.display = 'none';
    roomCodeInput.style.display = 'block';
    markAttendanceBtn.style.display = 'block';
    updateAttendRoomTab();
    stopCamera();
}

// Auto-close rooms based on deadline
setInterval(async () => {
    try {
        const roomsSnapshot = await getDocs(collection(db, 'rooms'));
        const now = new Date().getTime();
        const updates = roomsSnapshot.docs
            .filter(doc => {
                const room = doc.data();
                return room.status === 'open' && room.closeDeadline && now >= room.closeDeadline;
            })
            .map(doc => updateDoc(doc.ref, { status: 'closed' }));
        await Promise.all(updates);
        if (updates.length > 0) {
            if (currentPresenceRoom) stopPresenceAttendance();
        }
    } catch (error) {
        console.error('Error auto-closing rooms:', error);
    }
}, 60000);
