import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, updateDoc, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDzJv667X-NcmeXtzysHaVOfUexhzEgiFY",
    authDomain: "facedb-45e9c.firebaseapp.com",
    projectId: "facedb-45e9c",
    storageBucket: "facedb-45e9c.firebasestorage.app",
    messagingSenderId: "537182009611",
    appId: "1:537182009611:web:65291f0f3dff933435ca0e",
    measurementId: "G-6BGYEE8QF1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const video = document.getElementById('video');
const attendanceVideo = document.getElementById('attendance-video');
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
const sidebarOverlay = document.getElementById('sidebar-overlay');
const currentTabButton = document.getElementById('current-tab');
const currentTabName = document.getElementById('current-tab-name');
const currentModeDisplay = document.getElementById('current-mode');
const dropdownIndicator = document.getElementById('dropdown-indicator');
const attendanceModeDropdown = document.getElementById('attendance-mode-dropdown');
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const authSpinner = document.getElementById('auth-spinner');
const presenceSpinner = document.getElementById('presence-spinner');
let isRegisterMode = true;
let currentUser = null;
let presenceInterval = null;
let currentPresenceRoom = null;
let currentTab = 'create-room';
let createRoomMode = 'online';
let searchQuery = '';
let stream = null;
let isProcessing = false;
let modelsLoaded = false;
let modelsLoading = false;

// Initialize camera
async function startCamera() {
    if (stream) return true;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: { ideal: 15 } } });
        video.srcObject = stream;
        attendanceVideo.srcObject = stream;
        return true;
    } catch (err) {
        statusDisplay.textContent = 'Camera permission denied.';
        console.error('Error accessing camera:', err);
        return false;
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        attendanceVideo.srcObject = null;
    }
}

// Start camera immediately
startCamera();

// Lazy-load models only when needed
async function loadModels() {
    if (modelsLoaded || modelsLoading) return;
    modelsLoading = true;
    statusDisplay.textContent = 'Loading face recognition...';
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist'),
            faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist')
        ]);
        modelsLoaded = true;
        statusDisplay.textContent = '';
        console.log('Models loaded successfully: tinyFaceDetector, faceRecognitionNet');
    } catch (err) {
        console.error('Error loading models:', err);
        statusDisplay.textContent = 'Failed to load face recognition models. Please try again later.';
        modelsLoaded = false;
    } finally {
        modelsLoading = false;
    }
}

function updateCreateRoomForm() {
    attendanceCapInput.style.display = createRoomMode === 'online' ? 'block' : 'none';
    closeTimeInput.style.display = createRoomMode === 'online' ? 'block' : 'none';
    closeDeadlineInput.style.display = createRoomMode === 'online' ? 'block' : 'none';
    createRoomStatus.textContent = '';
}

function updateAttendRoomTab() {
    roomCodeInput.style.display = 'block';
    markAttendanceBtn.style.display = 'block';
    presenceCamera.style.display = 'none';
    attendRoomStatus.textContent = '';
    recognizedUserDisplay.textContent = '';
    stopCamera();
}

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
    document.querySelectorAll('.tick').forEach(tick => {
        tick.style.display = tick.dataset.mode === createRoomMode ? 'inline' : 'none';
    });
    if (tabId !== 'attend-room' && tabId !== 'create-room') stopCamera();
}

function initializeUI() {
    fullNameInput.style.display = isRegisterMode ? 'block' : 'none';
    authTitle.textContent = isRegisterMode ? 'Register Your Face' : 'Login';
    registerBtn.style.display = isRegisterMode ? 'inline' : 'none';
    loginBtn.style.display = isRegisterMode ? 'none' : 'inline';
    switchBtn.textContent = isRegisterMode ? 'Login' : 'Register';
    togglePrefix.textContent = isRegisterMode ? 'Already registered? ' : 'Need an account? ';
    updateCreateRoomForm();
    updateTabDisplay('create-room');

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

    registerBtn.addEventListener('click', async () => {
        if (isProcessing) return;
        isProcessing = true;
        registerBtn.disabled = true;
        authSpinner.style.display = 'block';
        if (!modelsLoaded && !modelsLoading) await loadModels();
        if (!modelsLoaded || !faceapi.nets.faceRecognitionNet.isLoaded) {
            statusDisplay.textContent = 'Face recognition model not loaded. Please try again later.';
            console.error('faceRecognitionNet not loaded.');
            authSpinner.style.display = 'none';
            registerBtn.disabled = false;
            isProcessing = false;
            return;
        }
        if (!stream) await startCamera();
        const fullName = fullNameInput.value.trim();
        if (!fullName || fullName.split(' ').length < 2) {
            statusDisplay.textContent = 'Enter a full name (e.g., John Doe)';
            authSpinner.style.display = 'none';
            registerBtn.disabled = false;
            isProcessing = false;
            return;
        }

        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('fullName', '==', fullName)));
            if (!userDoc.empty) {
                statusDisplay.textContent = 'User name already exists.';
                authSpinner.style.display = 'none';
                registerBtn.disabled = false;
                isProcessing = false;
                return;
            }

            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceDescriptor();
            if (!detections) {
                statusDisplay.textContent = 'No face detected. Align your face with the camera.';
                authSpinner.style.display = 'none';
                registerBtn.disabled = false;
                isProcessing = false;
                return;
            }

            const usersSnapshot = await getDocs(collection(db, 'users'));
            for (const userDoc of usersSnapshot.docs) {
                const user = userDoc.data();
                const storedDescriptor = new Float32Array(user.descriptor);
                const distance = faceapi.euclideanDistance(detections.descriptor, storedDescriptor);
                if (distance < 0.6) {
                    statusDisplay.textContent = 'Face already registered with another account.';
                    authSpinner.style.display = 'none';
                    registerBtn.disabled = false;
                    isProcessing = false;
                    return;
                }
            }

            await setDoc(doc(db, 'users', fullName), {
                fullName,
                descriptor: Array.from(detections.descriptor)
            });
            statusDisplay.textContent = 'Registered! Please login.';
            isRegisterMode = false;
            authTitle.textContent = 'Login';
            registerBtn.style.display = 'none';
            loginBtn.style.display = 'inline';
            switchBtn.textContent = 'Register';
            togglePrefix.textContent = 'Need an account? ';
            fullNameInput.style.display = 'none';
            fullNameInput.value = '';
            stopCamera();
            authSpinner.style.display = 'none';
            registerBtn.disabled = false;
            isProcessing = false;
        } catch (error) {
            console.error('Error registering:', error);
            statusDisplay.textContent = 'Registration failed. Try again later.';
            authSpinner.style.display = 'none';
            registerBtn.disabled = false;
            isProcessing = false;
        }
    });

    loginBtn.addEventListener('click', async () => {
        if (isProcessing) return;
        isProcessing = true;
        loginBtn.disabled = true;
        authSpinner.style.display = 'block';
        if (!modelsLoaded && !modelsLoading) await loadModels();
        if (!modelsLoaded || !faceapi.nets.faceRecognitionNet.isLoaded) {
            statusDisplay.textContent = 'Face recognition model not loaded. Please try again later.';
            console.error('faceRecognitionNet not loaded.');
            authSpinner.style.display = 'none';
            loginBtn.disabled = false;
            isProcessing = false;
            return;
        }
        if (!stream) await startCamera();
        try {
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceDescriptor();
            if (!detections) {
                statusDisplay.textContent = 'No face detected. Align your face with the camera.';
                authSpinner.style.display = 'none';
                loginBtn.disabled = false;
                isProcessing = false;
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
                showDashboard(matchedUser.fullName);
                stopCamera();
                authSpinner.style.display = 'none';
                loginBtn.disabled = false;
                isProcessing = false;
            } else {
                statusDisplay.textContent = 'Face not recognized. Try again.';
                authSpinner.style.display = 'none';
                loginBtn.disabled = false;
                isProcessing = false;
            }
        } catch (error) {
            console.error('Error logging in:', error);
            statusDisplay.textContent = 'Login failed. Try again later.';
            authSpinner.style.display = 'none';
            loginBtn.disabled = false;
            isProcessing = false;
        }
    });

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
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        currentTab = 'create-room';
        createRoomMode = 'online';
        searchQuery = '';
        searchInput.value = '';
        searchInput.style.display = 'none';
        updateTabDisplay('create-room');
        updateCreateRoomForm();
        startCamera();
    });

    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('attendance-screen').style.display = 'none';
        dashboard.style.display = 'flex';
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(currentTab).classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${currentTab}"]`).classList.add('active');
        updateTabDisplay(currentTab);
        if (currentTab === 'view-rooms') displayOpenRooms();
        else if (currentTab === 'rooms-history') displayRoomsHistory();
        stopCamera();
    });

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
        attendanceModeDropdown.style.display = 'none';
        searchInput.style.display = 'none';
        searchQuery = '';
        searchInput.value = '';
        if (currentTab === 'view-rooms') displayOpenRooms();
        else if (currentTab === 'rooms-history') displayRoomsHistory();
        stopCamera();
    });

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            attendanceModeDropdown.style.display = 'none';
            searchInput.style.display = 'none';
            searchQuery = '';
            searchInput.value = '';
            if (currentTab === 'view-rooms') displayOpenRooms();
            else if (currentTab === 'rooms-history') displayRoomsHistory();
            stopCamera();
        });
    } else {
        console.warn('Sidebar overlay element not found. Skipping event listener.');
    }

    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
            sidebar.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            stopPresenceAttendance();
            searchQuery = '';
            searchInput.value = '';
            searchInput.style.display = 'none';
            updateTabDisplay(button.dataset.tab);
            if (button.dataset.tab === 'view-rooms') displayOpenRooms();
            else if (button.dataset.tab === 'rooms-history') displayRoomsHistory();
            else if (button.dataset.tab === 'attend-room') updateAttendRoomTab();
            else if (button.dataset.tab === 'create-room') updateCreateRoomForm();
        });
    });

    createRoomBtn.addEventListener('click', async () => {
        const roomName = roomNameInput.value.trim();
        const attendanceCap = createRoomMode === 'online' ? parseInt(attendanceCapInput.value) || null : null;
        const closeTime = createRoomMode === 'online' ? (closeTimeInput.value ? parseInt(closeTimeInput.value) * 60 * 1000 : null) : null;
        const closeDeadline = createRoomMode === 'online' ? (closeDeadlineInput.value ? new Date(closeDeadlineInput.value).getTime() : null) : null;
        const attendanceMode = createRoomMode;

        if (!roomName) {
            createRoomStatus.textContent = 'Enter a room name';
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
            if (closeTime) setTimeout(() => closeRoom(roomName), closeTime);
            createRoomStatus.textContent = `Room created! ${roomCode ? `Code: ${roomCode}` : ''}`;
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
            createRoomStatus.textContent = 'Failed to create room.';
        }
    });

    markAttendanceBtn.addEventListener('click', async () => {
        const roomCode = roomCodeInput.value.trim();
        if (!currentUser) {
            attendRoomStatus.textContent = 'Please login to mark attendance.';
            return;
        }
        if (!roomCode) {
            attendRoomStatus.textContent = 'Enter a room code.';
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
                attendRoomStatus.textContent = 'Attendance already marked.';
                return;
            }

            room.attendees.push(currentUser);
            await updateDoc(doc(db, 'rooms', room.name), { attendees: room.attendees });
            attendRoomStatus.textContent = 'Attendance marked!';
            roomCodeInput.value = '';
        } catch (error) {
            console.error('Error marking attendance:', error);
            attendRoomStatus.textContent = 'Failed to mark attendance.';
        }
    });

    stopPresenceBtn.addEventListener('click', stopPresenceAttendance);

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
            if (currentTab === 'view-rooms') displayOpenRooms();
            else if (currentTab === 'rooms-history') displayRoomsHistory();
        }
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        if (currentTab === 'view-rooms') displayOpenRooms();
        else if (currentTab === 'rooms-history') displayRoomsHistory();
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
            openRoomsList.innerHTML = '<p>Please login to view rooms.</p>';
            return;
        }

        let q = query(collection(db, 'rooms'), where('status', '==', 'open'), where('creator', '==', currentUser));
        const roomsSnapshot = await getDocs(q);
        let openRooms = roomsSnapshot.docs.map(doc => doc.data());

        if (searchQuery) openRooms = openRooms.filter(room => room.name.toLowerCase().includes(searchQuery));

        openRoomsList.innerHTML = '';
        if (openRooms.length === 0) {
            openRoomsList.innerHTML = '<p>No open rooms.</p>';
            return;
        }

        const header = document.createElement('div');
        header.classList.add('rooms-header');
        header.innerHTML = `<span>Name</span><span>Created by</span><span>Created at</span><span>Mode</span><span>Code</span><span>Actions</span>`;
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
                    <button class="view-attendees-btn" data-room="${room.name}">View</button>
                    <button class="close-room-btn" data-room="${room.name}">Close</button>
                    <button class="delete-room-btn" data-room="${room.name}">Delete</button>
                    <button class="customize-rules-btn" data-room="${room.name}">Customize</button>
                </div>
            `;
            openRoomsList.appendChild(roomDiv);
        });

        document.querySelectorAll('.view-attendees-btn').forEach(btn => btn.addEventListener('click', () => viewAttendees(btn.dataset.room)));
        document.querySelectorAll('.close-room-btn').forEach(btn => btn.addEventListener('click', () => closeRoom(btn.dataset.room)));
        document.querySelectorAll('.delete-room-btn').forEach(btn => btn.addEventListener('click', () => deleteRoom(btn.dataset.room)));
        document.querySelectorAll('.customize-rules-btn').forEach(btn => btn.addEventListener('click', () => customizeRules(btn.dataset.room)));
    } catch (error) {
        console.error('Error fetching rooms:', error);
        openRoomsList.innerHTML = '<p>Error loading rooms.</p>';
    }
}

async function displayRoomsHistory() {
    try {
        if (!currentUser) {
            historyRoomsList.innerHTML = '<p>Please login to view rooms.</p>';
            return;
        }

        let q = query(collection(db, 'rooms'));
        const roomsSnapshot = await getDocs(q);
        let userRooms = roomsSnapshot.docs
            .map(doc => doc.data())
            .filter(room => room.creator === currentUser || room.attendees.includes(currentUser));

        if (searchQuery) userRooms = userRooms.filter(room => room.name.toLowerCase().includes(searchQuery));

        historyRoomsList.innerHTML = '';
        if (userRooms.length === 0) {
            historyRoomsList.innerHTML = '<p>No rooms in history.</p>';
            return;
        }

        const header = document.createElement('div');
        header.classList.add('rooms-header');
        header.innerHTML = `<span>Name</span><span>Created by</span><span>Created at</span><span>Status</span><span>Mode</span><span>Code</span><span>Attendance</span>`;
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
                <div class="room-actions">
                    <button class="view-attendees-btn" data-room="${room.name}" ${isCreator ? '' : 'disabled'}>View</button>
                    ${isCreator ? `<button class="delete-room-btn" data-room="${room.name}">Delete</button>` : ''}
                </div>
            `;
            historyRoomsList.appendChild(roomDiv);
        });

        document.querySelectorAll('.view-attendees-btn:not([disabled])').forEach(btn => btn.addEventListener('click', () => viewAttendees(btn.dataset.room)));
        document.querySelectorAll('.delete-room-btn').forEach(btn => btn.addEventListener('click', () => deleteRoom(btn.dataset.room)));
    } catch (error) {
        console.error('Error fetching history:', error);
        historyRoomsList.innerHTML = '<p>Error loading history.</p>';
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
            attendanceScreen.style.display = 'flex';
            return;
        }

        const room = roomDoc.data();
        dashboard.style.display = 'none';
        attendanceScreen.style.display = 'flex';
        roomNameHeader.textContent = `${room.name} Attendance`;

        if (room.attendees.length > 0) {
            attendeesTable.innerHTML = `
                <thead><tr><th>No.</th><th>Name</th></tr></thead>
                <tbody>${room.attendees.map((name, index) => `<tr><td>${index + 1}</td><td>${name}</td></tr>`).join('')}</tbody>
            `;
        } else {
            attendeesTable.innerHTML = `<tr class="no-attendees"><td colspan="2">No attendees.</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching attendees:', error);
        document.getElementById('attendees-list').innerHTML = `<tr class="no-attendees"><td colspan="2">Error loading attendees.</td></tr>`;
        document.getElementById('attendance-room-name').textContent = 'Error';
    }
}

async function closeRoom(roomName) {
    try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomName));
        if (roomDoc.exists() && roomDoc.data().status === 'open') {
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
        await deleteDoc(doc(db, 'rooms', roomName));
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

        const newCap = prompt('New attendance cap (blank for none):', room.attendanceCap || '');
        const newCloseTime = prompt('New close time in minutes (blank for none):', room.closeTime ? room.closeTime / 60000 : '');
        const newDeadline = prompt('New deadline (YYYY-MM-DDTHH:MM, blank for none):', room.closeDeadline ? new Date(room.closeDeadline).toISOString().slice(0, 16) : '');

        const updates = {};
        if (newCap !== null) updates.attendanceCap = newCap ? parseInt(newCap) : null;
        if (newCloseTime !== null) updates.closeTime = newCloseTime ? parseInt(newCloseTime) * 60 * 1000 : null;
        if (newDeadline !== null) updates.closeDeadline = newDeadline ? new Date(newDeadline).getTime() : null;

        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'rooms', roomName), updates);
            if (updates.closeTime) setTimeout(() => closeRoom(roomName), updates.closeTime);
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
            console.warn('Room not found, closed, or not in presence mode:', roomName);
            return;
        }

        if (!stream) await startCamera();
        if (!modelsLoaded && !modelsLoading) await loadModels();
        if (!modelsLoaded || !faceapi.nets.faceRecognitionNet.isLoaded) {
            recognizedUserDisplay.textContent = 'Face recognition model not loaded. Please try again later.';
            console.error('faceRecognitionNet not loaded.');
            stopCamera();
            return;
        }

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="attend-room"]').classList.add('active');
        document.getElementById('attend-room').classList.add('active');
        updateTabDisplay('attend-room');
        presenceCamera.style.display = 'flex';
        roomCodeInput.style.display = 'block';
        markAttendanceBtn.style.display = 'block';
        sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');

        presenceInterval = setInterval(async () => {
            if (isProcessing || !modelsLoaded) return;
            isProcessing = true;
            presenceSpinner.style.display = 'block';

            const roomDoc = await getDoc(doc(db, 'rooms', roomName));
            if (!roomDoc.exists()) {
                console.warn('Room no longer exists:', roomName);
                stopPresenceAttendance();
                presenceSpinner.style.display = 'none';
                isProcessing = false;
                return;
            }
            const room = roomDoc.data();
            if (room.status !== 'open' || (room.attendanceCap && room.attendees.length >= room.attendanceCap)) {
                console.warn('Room closed or cap reached:', roomName);
                stopPresenceAttendance();
                presenceSpinner.style.display = 'none';
                isProcessing = false;
                return;
            }

            const detections = await faceapi.detectSingleFace(attendanceVideo, new faceapi.TinyFaceDetectorOptions()).withFaceDescriptor();
            if (!detections) {
                recognizedUserDisplay.textContent = 'No face detected.';
                console.log('No face detected in presence attendance.');
                presenceSpinner.style.display = 'none';
                isProcessing = false;
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

            if (!matchedUser || !matchedUser.fullName) {
                recognizedUserDisplay.textContent = 'Face not recognized.';
                console.log('No matching user found or fullName missing:', matchedUser);
                presenceSpinner.style.display = 'none';
                isProcessing = false;
                return;
            }

            if (room.attendees.includes(matchedUser.fullName)) {
                recognizedUserDisplay.textContent = matchedUser.fullName + ' already marked.';
                console.log('User already marked:', matchedUser.fullName);
                presenceSpinner.style.display = 'none';
                isProcessing = false;
                return;
            }

            room.attendees.push(matchedUser.fullName);
            await updateDoc(doc(db, 'rooms', roomName), { attendees: room.attendees });
            recognizedUserDisplay.textContent = 'Recognized: ' + matchedUser.fullName;
            console.log('Attendance marked for:', matchedUser.fullName);
            setTimeout(() => {
                if (recognizedUserDisplay.textContent === 'Recognized: ' + matchedUser.fullName) {
                    recognizedUserDisplay.textContent = '';
                }
            }, 3000);
            presenceSpinner.style.display = 'none';
            isProcessing = false;
        }, 4000);
    } catch (error) {
        console.error('Error in presence attendance:', error);
        recognizedUserDisplay.textContent = 'Presence attendance failed.';
        stopCamera();
        presenceSpinner.style.display = 'none';
        isProcessing = false;
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
    isProcessing = false;
    presenceSpinner.style.display = 'none';
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
        if (updates.length > 0 && currentPresenceRoom) stopPresenceAttendance();
    } catch (error) {
        console.error('Error auto-closing rooms:', error);
    }
}, 60000);

// Initialize UI after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.tab-btn[data-tab="create-room"]').classList.add('active');
    document.getElementById('create-room').classList.add('active');
    updateTabDisplay('create-room');
    updateCreateRoomForm();
    initializeUI();
});
