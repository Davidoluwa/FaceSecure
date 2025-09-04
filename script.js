// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, updateDoc, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
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

// DOM elements
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
const capturePresenceBtn = document.getElementById('capture-presence-btn');
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
let currentPresenceRoom = null;
let currentTab = 'create-room';
let createRoomMode = 'online';
let searchQuery = '';
let stream = null;
let userDescriptors = null; // Cache for user descriptors
let isProcessing = false; // Prevent overlapping face detection
let faceWorker = null; // Web Worker for face detection

// Create sidebar overlay
const sidebarOverlay = document.querySelector('.sidebar-overlay');

// Initialize Web Worker
function initFaceWorker() {
    faceWorker = new Worker('/FaceSecure/faceWorker.js');
    faceWorker.postMessage({ type: 'loadModels' });
    return new Promise(resolve => {
        faceWorker.onmessage = e => {
            if (e.data.type === 'modelsLoaded') resolve();
        };
    });
}

// Debounce utility for button clicks
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Optimized camera start with dynamic resolution
async function startCamera() {
    if (stream) return true;
    try {
        const isLowRam = navigator.deviceMemory && navigator.deviceMemory <= 1;
        const isMobile = window.innerWidth <= 768;
        const constraints = {
            video: {
                width: { ideal: isLowRam || isMobile ? 240 : 320 },
                height: { ideal: isLowRam || isMobile ? 180 : 240 }
            }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
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

// Update attend room tab UI
function updateAttendRoomTab() {
    roomCodeInput.style.display = 'block';
    markAttendanceBtn.style.display = 'block';
    presenceCamera.style.display = 'none';
    attendRoomStatus.textContent = '';
    recognizedUserDisplay.textContent = '';
    stopCamera();
}

// Update tab display
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

// Update dropdown ticks
function updateDropdownTicks() {
    document.querySelectorAll('.tick').forEach(tick => {
        tick.style.display = tick.dataset.mode === createRoomMode ? 'inline' : 'none';
    });
}

// Cache user descriptors
async function cacheUserDescriptors() {
    if (!userDescriptors) {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        userDescriptors = usersSnapshot.docs.map(doc => ({
            fullName: doc.data().fullName,
            descriptor: new Float32Array(doc.data().descriptor)
        }));
    }
    return userDescriptors;
}

// Main start function
async function start() {
    await initFaceWorker(); // Initialize Web Worker
    fullNameInput.style.display = isRegisterMode ? 'block' : 'none';
    authTitle.textContent = isRegisterMode ? 'Register Your Face' : 'Login';
    registerBtn.style.display = isRegisterMode ? 'inline' : 'none';
    loginBtn.style.display = isRegisterMode ? 'none' : 'inline';
    switchBtn.textContent = isRegisterMode ? 'Login' : 'Register';
    togglePrefix.textContent = isRegisterMode ? 'Already registered? ' : 'Need an account? ';
    updateCreateRoomForm();
    updateTabDisplay('create-room');
    await startCamera();

    // Debounced event listeners
    const debouncedRegister = debounce(async () => {
        if (isProcessing) return;
        isProcessing = true;
        if (!stream) await startCamera();
        const fullName = fullNameInput.value.trim();
        if (!fullName || fullName.split(' ').length < 2) {
            statusDisplay.textContent = 'Please enter a full name with at least two names';
            stopCamera();
            isProcessing = false;
            return;
        }

        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('fullName', '==', fullName)));
            if (!userDoc.empty) {
                statusDisplay.textContent = 'User with this name already exists.';
                stopCamera();
                isProcessing = false;
                return;
            }

            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const imageData = canvas.getImageData(0, 0, canvas.width, canvas.height);

            faceWorker.postMessage({
                type: 'detectFace',
                imageData,
                minConfidence: 0.4,
                inputSize: 128
            });

            faceWorker.onmessage = e => {
                if (e.data.type === 'detectionResult') {
                    const detections = e.data.detections;
                    if (!detections) {
                        statusDisplay.textContent = 'No face detected. Please align your face with the camera.';
                        stopCamera();
                        isProcessing = false;
                        return;
                    }

                    cacheUserDescriptors().then(users => {
                        for (const user of users) {
                            const distance = faceapi.euclideanDistance(detections.descriptor, user.descriptor);
                            if (distance < 0.6) {
                                statusDisplay.textContent = 'This face is already registered with another account.';
                                stopCamera();
                                isProcessing = false;
                                return;
                            }
                        }

                        setDoc(doc(db, 'users', fullName), {
                            fullName,
                            descriptor: Array.from(detections.descriptor)
                        }).then(() => {
                            console.log('Registered user:', fullName);
                            statusDisplay.textContent = 'Registration successful! Please login.';
                            isRegisterMode = false;
                            authTitle.textContent = 'Login';
                            registerBtn.style.display = 'none';
                            loginBtn.style.display = 'inline';
                            switchBtn.textContent = 'Register';
                            togglePrefix.textContent = 'Need an account? ';
                            fullNameInput.style.display = 'none';
                            fullNameInput.value = '';
                            stopCamera();
                            isProcessing = false;
                            userDescriptors = null; // Clear cache to refresh on next load
                        });
                    });
                } else if (e.data.type === 'detectionError') {
                    console.error('Face detection error:', e.data.error);
                    statusDisplay.textContent = 'Error detecting face. Please try again.';
                    stopCamera();
                    isProcessing = false;
                }
            };
        } catch (error) {
            console.error('Error registering user:', error);
            statusDisplay.textContent = 'Error registering user. Please try again.';
            stopCamera();
            isProcessing = false;
        }
    }, 300);

    const debouncedLogin = debounce(async () => {
        if (isProcessing) return;
        isProcessing = true;
        if (!stream) await startCamera();
        try {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const imageData = canvas.getImageData(0, 0, canvas.width, canvas.height);

            faceWorker.postMessage({
                type: 'detectFace',
                imageData,
                minConfidence: 0.4,
                inputSize: 128
            });

            faceWorker.onmessage = e => {
                if (e.data.type === 'detectionResult') {
                    const detections = e.data.detections;
                    if (!detections) {
                        statusDisplay.textContent = 'No face detected. Please align your face with the camera.';
                        isProcessing = false;
                        return;
                    }

                    cacheUserDescriptors().then(users => {
                        let matchedUser = null;
                        for (const user of users) {
                            const distance = faceapi.euclideanDistance(detections.descriptor, user.descriptor);
                            if (distance < 0.6) {
                                matchedUser = user;
                                break;
                            }
                        }

                        if (matchedUser) {
                            statusDisplay.textContent = 'Login successful!';
                            currentUser = matchedUser.fullName;
                            console.log('Logged in user:', currentUser);
                            showDashboard(matchedUser.fullName);
                            stopCamera();
                            isProcessing = false;
                        } else {
                            statusDisplay.textContent = 'Face not recognized. Please try again.';
                            isProcessing = false;
                        }
                    });
                } else if (e.data.type === 'detectionError') {
                    console.error('Face detection error:', e.data.error);
                    statusDisplay.textContent = 'Error logging in. Please try again.';
                    isProcessing = false;
                }
            };
        } catch (error) {
            console.error('Error logging in:', error);
            statusDisplay.textContent = 'Error logging in. Please try again.';
            isProcessing = false;
        }
    }, 300);

    // Attach debounced listeners
    registerBtn.addEventListener('click', debouncedRegister);
    loginBtn.addEventListener('click', debouncedLogin);
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
        startCamera();
    });

    logoutBtn.addEventListener('click', () => {
        dashboard.style.display = 'none';
        document.querySelector('.auth-container').style.display = 'flex';
        fullNameInput.value = '';
        statusDisplay.textContent = '';
        currentUser = null;
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
        userDescriptors = null; // Clear cache
        startCamera();
    });

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

    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
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

    const debouncedCreateRoom = debounce(async () => {
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
            console.log('Created room:', room);
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
    }, 300);

    createRoomBtn.addEventListener('click', debouncedCreateRoom);

    const debouncedMarkAttendance = debounce(async () => {
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

            room.attendees.push(currentUser);
            await updateDoc(doc(db, 'rooms', room.name), { attendees: room.attendees });
            console.log('Updated room with attendance:', room);
            attendRoomStatus.textContent = 'Attendance marked successfully!';
            roomCodeInput.value = '';
        } catch (error) {
            console.error('Error marking attendance:', error);
            attendRoomStatus.textContent = 'Error marking attendance. Please try again.';
        }
    }, 300);

    markAttendanceBtn.addEventListener('click', debouncedMarkAttendance);
    stopPresenceBtn.addEventListener('click', () => stopPresenceAttendance());

    currentTabButton.addEventListener('click', () => {
        if (currentTab === 'create-room') {
            attendanceModeDropdown.style.display = attendanceModeDropdown.style.display === 'none' ? 'flex' : 'none';
        }
    });

    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            createRoomMode = item.dataset.mode;
            updateCreateRoomForm();
            updateTabDisplay(currentTab);
            attendanceModeDropdown.style.display = 'none';
        });
    });

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

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        if (currentTab === 'view-rooms') {
            displayOpenRooms();
        } else if (currentTab === 'rooms-history') {
            displayRoomsHistory();
        }
    });

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

        let q = query(collection(db, 'rooms'));
        const roomsSnapshot = await getDocs(q);
        let userRooms = roomsSnapshot.docs
            .map(doc => doc.data())
            .filter(room => room.creator === currentUser || room.attendees.includes(currentUser));

        if (searchQuery) {
            userRooms = userRooms.filter(room => room.name.toLowerCase().includes(searchQuery));
        }

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
            attendeesTable.innerHTML = `<tr class="no-attendees"><td colspan="2">Room not found.</td></tr>`;
            roomNameHeader.textContent = 'Error';
            dashboard.style.display = 'none';
            attendanceScreen.classList.add('active');
            attendanceScreen.style.display = 'flex';
            console.error('Room not found:', roomName);
            return;
        }

        const room = roomDoc.data();
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
            attendeesTable.innerHTML = `<tr class="no-attendees"><td colspan="2">No attendees yet.</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching attendees:', error);
        attendeesTable.innerHTML = `<tr class="no-attendees"><td colspan="2">Error loading attendees.</td></tr>`;
        document.getElementById('attendance-room-name').textContent = 'Error';
    }
}

async function closeRoom(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        if (roomDoc.exists() && roomDoc.data().status === 'open') {
            await updateDoc(doc(db, 'rooms', roomName), { status: 'closed' });
            console.log('Closed room:', roomName);
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
        await deleteDoc(doc(db, 'rooms', roomName));
        console.log('Deleted room:', roomName);
        stopPresenceAttendance();
        displayOpenRooms();
        displayRoomsHistory();
    } catch (error) {
        console.error('Error deleting room:', error);
    }
}

async function customizeRules(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        if (!roomDoc.exists() || roomDoc.data().status !== 'open') return;
        const room = roomDoc.data();

        const newCap = prompt('Enter new attendance cap (leave blank for no cap):', room.attendanceCap || '');
        const newCloseTime = prompt('Enter new auto-close time in minutes (leave blank for none):', room.closeTime ? room.closeTime / 60000 : '');
        const newDeadline = prompt('Enter new close deadline (YYYY-MM-DDTHH:MM, leave blank for none):', room.closeDeadline ? new Date(room.closeDeadline).toISOString().slice(0, 16) : '');

        const updates = {};
        if (newCap !== null) updates.attendanceCap = newCap ? parseInt(newCap) : null;
        if (newCloseTime !== null) updates.closeTime = newCloseTime ? parseInt(newCloseTime) * 60 * 1000 : null;
        if (newDeadline !== null) updates.closeDeadline = newDeadline ? new Date(newDeadline).getTime() : null;

        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'rooms', roomName), updates);
            console.log('Updated room rules:', roomName, updates);
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
        if (!roomDoc.exists() || roomDoc.data().status !== 'open' || roomDoc.data().mode !== 'presence') {
            console.log('Presence room not found or not open:', roomName);
            attendRoomStatus.textContent = 'Presence room not found or closed.';
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

        // Remove existing listeners to prevent memory leaks
        const newCaptureBtn = capturePresenceBtn.cloneNode(true);
        capturePresenceBtn.parentNode.replaceChild(newCaptureBtn, capturePresenceBtn);

        // Debounced capture button
        const debouncedCapture = debounce(async () => {
            if (isProcessing) return;
            isProcessing = true;
            recognizedUserDisplay.textContent = 'Capturing...';

            try {
                const roomDoc = await getDoc(doc(db, 'rooms', roomName));
                if (!roomDoc.exists()) {
                    recognizedUserDisplay.textContent = 'Room not found.';
                    stopPresenceAttendance();
                    isProcessing = false;
                    return;
                }
                const room = roomDoc.data();
                if (room.status !== 'open' || (room.attendanceCap && room.attendees.length >= room.attendanceCap)) {
                    recognizedUserDisplay.textContent = 'Room is closed or attendance cap reached.';
                    stopPresenceAttendance();
                    isProcessing = false;
                    return;
                }

                const ctx = canvas.getContext('2d');
                canvas.width = attendanceVideo.videoWidth;
                canvas.height = attendanceVideo.videoHeight;
                ctx.drawImage(attendanceVideo, 0, 0);
                const imageData = canvas.getImageData(0, 0, canvas.width, canvas.height);

                faceWorker.postMessage({
                    type: 'detectFace',
                    imageData,
                    minConfidence: 0.4,
                    inputSize: 128
                });

                faceWorker.onmessage = e => {
                    if (e.data.type === 'detectionResult') {
                        const detections = e.data.detections;
                        if (!detections) {
                            recognizedUserDisplay.textContent = 'No face detected. Please align your face with the camera.';
                            isProcessing = false;
                            return;
                        }

                        cacheUserDescriptors().then(users => {
                            let matchedUser = null;
                            for (const user of users) {
                                const distance = faceapi.euclideanDistance(detections.descriptor, user.descriptor);
                                if (distance < 0.6) {
                                    matchedUser = user;
                                    break;
                                }
                            }

                            if (!matchedUser) {
                                recognizedUserDisplay.textContent = 'Face not recognized. Please try again.';
                                isProcessing = false;
                                return;
                            }

                            if (room.attendees.includes(matchedUser.fullName)) {
                                recognizedUserDisplay.textContent = `${matchedUser.fullName} has already marked attendance.`;
                                isProcessing = false;
                                return;
                            }

                            room.attendees.push(matchedUser.fullName);
                            updateDoc(doc(db, 'rooms', roomName), { attendees: room.attendees }).then(() => {
                                console.log('Presence attendance marked:', room);
                                recognizedUserDisplay.textContent = `Recognized: ${matchedUser.fullName}`;
                                setTimeout(() => {
                                    if (recognizedUserDisplay.textContent === `Recognized: ${matchedUser.fullName}`) {
                                        recognizedUserDisplay.textContent = '';
                                    }
                                    isProcessing = false;
                                }, 3000);
                            });
                        });
                    } else if (e.data.type === 'detectionError') {
                        console.error('Face detection error:', e.data.error);
                        recognizedUserDisplay.textContent = 'Error capturing face. Please try again.';
                        isProcessing = false;
                    }
                };
            } catch (error) {
                console.error('Error during presence capture:', error);
                recognizedUserDisplay.textContent = 'Error capturing face. Please try again.';
                isProcessing = false;
            }
        }, 300);

        newCaptureBtn.addEventListener('click', debouncedCapture);
    } catch (error) {
        console.error('Error starting presence attendance:', error);
        recognizedUserDisplay.textContent = 'Error starting presence attendance.';
        stopCamera();
    }
}

function stopPresenceAttendance() {
    if (currentPresenceRoom) {
        closeRoom(currentPresenceRoom);
        currentPresenceRoom = null;
    }
    presenceCamera.style.display = 'none';
    roomCodeInput.style.display = 'block';
    markAttendanceBtn.style.display = 'block';
    updateAttendRoomTab();
    stopCamera();
    if (faceWorker) {
        faceWorker.terminate();
        faceWorker = null;
        initFaceWorker(); // Reinitialize for next use
    }
}

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
            console.log('Auto-closed rooms:', updates.length);
            if (currentPresenceRoom) stopPresenceAttendance();
        }
    } catch (error) {
        console.error('Error auto-closing rooms:', error);
    }
}, 60000);
