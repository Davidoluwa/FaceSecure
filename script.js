// Firebase imports and configuration remain unchanged
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

// Show loading screen during model loading
const loadingScreen = document.getElementById('loading-screen');
loadingScreen.style.display = 'flex';

// Load face-api.js models
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/FaceSecure/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/FaceSecure/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/FaceSecure/models')
]).then(() => {
    loadingScreen.style.display = 'none'; // Hide loading screen after models are loaded
    start();
});

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
let lastFrameTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

// Create loading spinner element
const loadingSpinner = document.createElement('div');
loadingSpinner.className = 'loading-spinner';
loadingSpinner.style.display = 'none';
document.querySelector('.video-container').appendChild(loadingSpinner);

// Function to show loading screen
function showLoadingScreen() {
    loadingScreen.style.display = 'flex';
}

// Function to hide loading screen
function hideLoadingScreen() {
    loadingScreen.style.display = 'none';
}

// Function to start the camera
async function startCamera() {
    if (stream) return true;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                frameRate: { ideal: targetFPS, max: targetFPS },
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        video.srcObject = stream;
        attendanceVideo.srcObject = stream;
        requestAnimationFrame(renderFrame);
        return true;
    } catch (err) {
        statusDisplay.textContent = 'Camera permission denied. Please allow camera access.';
        console.error('Error accessing camera:', err);
        return false;
    }
}

// Function to stop the camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        attendanceVideo.srcObject = null;
    }
    loadingSpinner.style.display = 'none';
    hideLoadingScreen();
}

// Render video frame at 60 FPS
function renderFrame(timestamp) {
    if (!stream) return;
    if (timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;
    }
    requestAnimationFrame(renderFrame);
}

// Show loading spinner
function showLoadingSpinner() {
    loadingSpinner.style.display = 'flex';
}

// Hide loading spinner
function hideLoadingSpinner() {
    loadingSpinner.style.display = 'none';
}

// Capture a single frame after 2 seconds
async function captureFrame(videoElement, callback) {
    showLoadingSpinner();
    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds to capture frame
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
    
    hideLoadingSpinner();
    showLoadingScreen(); // Show loading screen during face detection
    
    const detections = await faceapi.detectSingleFace(tempCanvas)
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    hideLoadingScreen(); // Hide loading screen after face detection
    callback(detections);
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
    fullNameInput.style.display = isRegisterMode ? 'block' : 'none';
    authTitle.textContent = isRegisterMode ? 'Register Your Face' : 'Login';
    registerBtn.style.display = isRegisterMode ? 'inline' : 'none';
    loginBtn.style.display = isRegisterMode ? 'none' : 'inline';
    switchBtn.textContent = isRegisterMode ? 'Login' : 'Register';
    togglePrefix.textContent = isRegisterMode ? 'Already registered? ' : 'Need an account? ';
    updateCreateRoomForm();
    updateTabDisplay('create-room');
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
        startCamera();
    });

    // Register button event
    registerBtn.addEventListener('click', async () => {
        registerBtn.disabled = true;
        statusDisplay.textContent = 'Capturing face...';
        showLoadingSpinner();

        if (!stream) await startCamera();
        const fullName = fullNameInput.value.trim();
        if (!fullName || fullName.split(' ').length < 2) {
            statusDisplay.textContent = 'Please enter a full name with at least two names';
            registerBtn.disabled = false;
            hideLoadingSpinner();
            stopCamera();
            return;
        }

        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('fullName', '==', fullName)));
            if (!userDoc.empty) {
                statusDisplay.textContent = 'User with this name already exists.';
                registerBtn.disabled = false;
                hideLoadingSpinner();
                stopCamera();
                return;
            }

            await captureFrame(video, async (detections) => {
                if (!detections) {
                    statusDisplay.textContent = 'No face detected. Please align your face with the camera.';
                    registerBtn.disabled = false;
                    stopCamera();
                    return;
                }

                const usersSnapshot = await getDocs(collection(db, 'users'));
                for (const userDoc of usersSnapshot.docs) {
                    const user = userDoc.data();
                    const storedDescriptor = new Float32Array(user.descriptor);
                    const distance = faceapi.euclideanDistance(detections.descriptor, storedDescriptor);
                    if (distance < 0.6) {
                        statusDisplay.textContent = 'This face is already registered with another account.';
                        registerBtn.disabled = false;
                        stopCamera();
                        return;
                    }
                }

                await setDoc(doc(db, 'users', fullName), {
                    fullName,
                    descriptor: Array.from(detections.descriptor)
                });
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
                registerBtn.disabled = false;
                stopCamera();
            });
        } catch (error) {
            console.error('Error registering user:', error);
            statusDisplay.textContent = 'Error registering user. Please try again.';
            registerBtn.disabled = false;
            stopCamera();
        }
    });

    // Login button event
    loginBtn.addEventListener('click', async () => {
        loginBtn.disabled = true;
        statusDisplay.textContent = 'Capturing face...';
        showLoadingSpinner();

        if (!stream) await startCamera();
        try {
            await captureFrame(video, async (detections) => {
                if (!detections) {
                    statusDisplay.textContent = 'No face detected. Please align your face with the camera.';
                    loginBtn.disabled = false;
                    stopCamera();
                    return;
                }

                const usersSnapshot = await getDocs(collection(db, 'users'));
                let matchedUser = null;
                for (const userDoc of usersSnapshot.docs) {
                    const user = userDoc.data();
                    const storedDescriptor = new Float32Array(user.descriptor);
                    const distance = faceapi.euclideanDistance(detections.descriptor, storedDescriptor);
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
                    loginBtn.disabled = false;
                    stopCamera();
                } else {
                    statusDisplay.textContent = 'Face not recognized. Please try again.';
                    loginBtn.disabled = false;
                    stopCamera();
                }
            });
        } catch (error) {
            console.error('Error logging in:', error);
            statusDisplay.textContent = 'Error logging in. Please try again.';
            loginBtn.disabled = false;
            stopCamera();
        }
    });

    // Logout button event
    logoutBtn.addEventListener('click', () => {
        logoutBtn.disabled = true;
        setTimeout(() => {
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
            logoutBtn.disabled = false;
        }, 100);
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
            button.disabled = true;
            setTimeout(() => {
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
                button.disabled = false;
            }, 100);
        });
    });

    // Create room event
    createRoomBtn.addEventListener('click', async () => {
        createRoomBtn.disabled = true;
        createRoomStatus.textContent = 'Creating room...';
        const roomName = roomNameInput.value.trim();
        const attendanceCap = createRoomMode === 'online' ? parseInt(attendanceCapInput.value) || null : null;
        const closeTime = createRoomMode === 'online' ? (closeTimeInput.value ? parseInt(closeTimeInput.value) * 60 * 1000 : null) : null;
        const closeDeadline = createRoomMode === 'online' ? (closeDeadlineInput.value ? new Date(closeDeadlineInput.value).getTime() : null) : null;
        const attendanceMode = createRoomMode;

        if (!roomName) {
            createRoomStatus.textContent = 'Please enter a room name';
            createRoomBtn.disabled = false;
            return;
        }

        try {
            const roomDoc = await getDocs(query(collection(db, 'rooms'), where('name', '==', roomName), where('status', '==', 'open')));
            if (!roomDoc.empty) {
                createRoomStatus.textContent = 'Room name already exists';
                createRoomBtn.disabled = false;
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
            createRoomBtn.disabled = false;

            if (attendanceMode === 'presence') {
                currentPresenceRoom = roomName;
                startPresenceAttendance(roomName);
            }
        } catch (error) {
            console.error('Error creating room:', error);
            createRoomStatus.textContent = 'Error creating room. Please try again.';
            createRoomBtn.disabled = false;
        }
    });

    // Mark attendance event (for online mode)
    markAttendanceBtn.addEventListener('click', async () => {
        markAttendanceBtn.disabled = true;
        attendRoomStatus.textContent = 'Marking attendance...';
        const roomCode = roomCodeInput.value.trim();
        if (!currentUser) {
            attendRoomStatus.textContent = 'You must be logged in to mark attendance.';
            markAttendanceBtn.disabled = false;
            return;
        }
        if (!roomCode) {
            attendRoomStatus.textContent = 'Please enter a room code.';
            markAttendanceBtn.disabled = false;
            return;
        }

        try {
            const roomsSnapshot = await getDocs(query(collection(db, 'rooms'), where('code', '==', roomCode), where('status', '==', 'open')));
            if (roomsSnapshot.empty) {
                attendRoomStatus.textContent = 'Invalid or closed room code';
                markAttendanceBtn.disabled = false;
                return;
            }

            const roomDoc = roomsSnapshot.docs[0];
            const room = roomDoc.data();

            if (room.attendanceCap && room.attendees.length >= room.attendanceCap) {
                attendRoomStatus.textContent = 'Attendance cap reached';
                markAttendanceBtn.disabled = false;
                return;
            }

            const userDoc = await getDocs(query(collection(db, 'users'), where('fullName', '==', currentUser)));
            if (userDoc.empty) {
                attendRoomStatus.textContent = 'User not found. Please re-login.';
                markAttendanceBtn.disabled = false;
                return;
            }

            if (room.attendees.includes(currentUser)) {
                attendRoomStatus.textContent = 'You have already marked attendance for this room';
                markAttendanceBtn.disabled = false;
                return;
            }

            room.attendees.push(currentUser);
            await updateDoc(doc(db, 'rooms', room.name), { attendees: room.attendees });
            console.log('Updated room with attendance:', room);
            attendRoomStatus.textContent = 'Attendance marked successfully!';
            roomCodeInput.value = '';
            markAttendanceBtn.disabled = false;
        } catch (error) {
            console.error('Error marking attendance:', error);
            attendRoomStatus.textContent = 'Error marking attendance. Please try again.';
            markAttendanceBtn.disabled = false;
        }
    });

    // Stop presence attendance
    stopPresenceBtn.addEventListener('click', () => {
        stopPresenceBtn.disabled = true;
        setTimeout(() => {
            stopPresenceAttendance();
            stopPresenceBtn.disabled = false;
        }, 100);
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
            btn.addEventListener('click', () => {
                btn.disabled = true;
                setTimeout(() => {
                    viewAttendees(btn.dataset.room);
                    btn.disabled = false;
                }, 100);
            });
        });
        document.querySelectorAll('.close-room-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.disabled = true;
                setTimeout(() => {
                    closeRoom(btn.dataset.room);
                    btn.disabled = false;
                }, 100);
            });
        });
        document.querySelectorAll('.delete-room-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.disabled = true;
                setTimeout(() => {
                    deleteRoom(btn.dataset.room);
                    btn.disabled = false;
                }, 100);
            });
        });
        document.querySelectorAll('.customize-rules-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.disabled = true;
                setTimeout(() => {
                    customizeRules(btn.dataset.room);
                    btn.disabled = false;
                }, 100);
            });
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
            btn.addEventListener('click', () => {
                btn.disabled = true;
                setTimeout(() => {
                    viewAttendees(btn.dataset.room);
                    btn.disabled = false;
                }, 100);
            });
        });
        document.querySelectorAll('.delete-room-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.disabled = true;
                setTimeout(() => {
                    deleteRoom(btn.dataset.room);
                    btn.disabled = false;
                }, 100);
            });
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

            await captureFrame(attendanceVideo, async (detections) => {
                if (!detections) {
                    recognizedUserDisplay.textContent = 'No face detected. Please align your face with the camera.';
                    return;
                }

                const usersSnapshot = await getDocs(collection(db, 'users'));
                let matchedUser = null;
                for (const userDoc of usersSnapshot.docs) {
                    const user = userDoc.data();
                    const storedDescriptor = new Float32Array(user.descriptor);
                    const distance = faceapi.euclideanDistance(detections.descriptor, storedDescriptor);
                    if (distance < 0.6) {
                        matchedUser = user;
                        break;
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

                room.attendees.push(matchedUser.fullName);
                await updateDoc(doc(db, 'rooms', roomName), { attendees: room.attendees });
                console.log('Presence attendance marked:', room);
                recognizedUserDisplay.textContent = `Recognized: ${matchedUser.fullName}`;
                setTimeout(() => {
                    if (recognizedUserDisplay.textContent === `Recognized: ${matchedUser.fullName}`) {
                        recognizedUserDisplay.textContent = '';
                    }
                }, 3000);
            });
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
