// app.js
import {
    auth, db, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    collection, addDoc, query, orderBy, getDocs, serverTimestamp
} from './firebase.js';

import {
    createMusicItemElement,
    openAddModal, closeAddModal,
    openEditModal, closeEditModal, handleEditFormSubmit,
    closeAnyOpenDropdown
} from './ui.js';

// --- Constants ---
const REGULAR_ADMIN_EMAIL = "admin@admin.com";
const SUPER_ADMIN_EMAIL = "super_admin@admin.com";
const YOUR_SUPER_ADMIN_UID = "8ix4GhF65ENqR6nVB6VrH3n4qJy2";
let targetLoginEmail = REGULAR_ADMIN_EMAIL;

// --- DOM Elements ---
const loginFormContainer = document.getElementById('loginFormContainer');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const messageDiv = document.getElementById('message');
const dataSectionDiv = document.getElementById('dataSection');
const musicListContainer = document.getElementById('musicListContainer');

// Modal Elements
const addMusicModal = document.getElementById('addMusicModal');
const closeAddMusicModalButton = document.getElementById('closeAddMusicModalButton');
const cancelAddMusicButton = document.getElementById('cancelAddMusicButton');
const addMusicForm = document.getElementById('addMusicForm');
const saveMusicButton = document.getElementById('saveMusicButton');
const addMusicMessage = document.getElementById('addMusicMessage');
const editMusicModal = document.getElementById('editMusicModal');
const closeEditMusicModalButton = document.getElementById('closeEditMusicModalButton');
const cancelEditMusicButton = document.getElementById('cancelEditMusicButton');
const editMusicForm = document.getElementById('editMusicForm');


// FAB Elements
const fabContainer = document.getElementById('fabContainer');
const fabButton = document.getElementById('fabButton');
const fabIconPlus = document.getElementById('fabIconPlus');
const fabIconClose = document.getElementById('fabIconClose');
const fabActions = document.getElementById('fabActions');
const openAddMusicFab = document.getElementById('openAddMusicFab');
const logoutFab = document.getElementById('logoutFab');

let fabOpen = false;

// --- Auth State Change Handler ---
onAuthStateChanged(auth, (user) => {
    updateGlobalUI(user);
    if (user) {
        console.log("로그인 상태:", user.email);
    } else {
        console.log("로그아웃 상태");
    }
});

function updateGlobalUI(user) {
    if (user) { // 로그인
        loginFormContainer.classList.add('hidden');
        fabContainer.classList.remove('hidden');
        dataSectionDiv.classList.remove('hidden');
        loadAndDisplayMusicData();

        passwordInput.value = "";
        passwordInput.type = "password";
        targetLoginEmail = REGULAR_ADMIN_EMAIL;
        if (messageDiv && messageDiv.textContent.includes("로그인 모드")) {
            messageDiv.textContent = "";
        }
    } else { // 로그아웃
        loginFormContainer.classList.remove('hidden');
        loginFormContainer.classList.replace('border-red-500', 'border-transparent');
        passwordInput.value = "";
        passwordInput.type = "password";
        if (typeof grecaptcha !== 'undefined') {
            grecaptcha.reset();
        }
        fabContainer.classList.add('hidden');
        dataSectionDiv.classList.add('hidden');
        musicListContainer.innerHTML = '';
        targetLoginEmail = REGULAR_ADMIN_EMAIL;
        if (messageDiv) {
            messageDiv.textContent = "";
        }
        closeAnyOpenDropdown();
        if (fabOpen) {
            fabButton.click();
        }
    }
}

// --- Data Loading ---
export async function loadAndDisplayMusicData() {
    if (!auth.currentUser) return;

    musicListContainer.innerHTML = '<p class="text-center text-gray-500">음악 목록을 불러오는 중...</p>';
    try {
        const musicCollectionRef = collection(db, "musicbox");
        const q = query(musicCollectionRef,
            orderBy("isPinned", "desc"),
            orderBy("pinnedAt", "desc"),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            musicListContainer.innerHTML = '<p class="text-center text-gray-500">아직 등록된 음악이 없어요. 첫 곡을 추가해보세요!</p>';
            return;
        }
        musicListContainer.innerHTML = '';
        querySnapshot.forEach((docSnapshot) => {
            const music = docSnapshot.data();
            const musicElement = createMusicItemElement(docSnapshot.id, music, auth.currentUser, YOUR_SUPER_ADMIN_UID);
            musicListContainer.appendChild(musicElement);
        });
    } catch (error) {
        console.error("음악 데이터 로드 실패:", error);
        // ... (기존 에러 처리 로직)
        if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
            const firestoreConsoleLinkRegex = /(https:\/\/console\.firebase\.google\.com\/project\/[^/]+\/firestore\/indexes\?create_composite=.+)/;
            const match = error.message.match(firestoreConsoleLinkRegex);
            let indexLinkHtml = "";
            if (match && match[1]) {
                indexLinkHtml = `<p class="text-center text-sm text-gray-500 mt-1"> Firestore 콘솔에서 <a href="${match[1]}" target="_blank" class="text-indigo-600 hover:underline">이 링크</a>를 통해 색인을 생성해 보세요. </p>`;
            }
            musicListContainer.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong class="font-bold">데이터 정렬 오류!</strong>
                    <span class="block sm:inline"> 필요한 Firestore 색인이 없습니다.</span>
                    <p class="text-sm mt-2">
                        <b>컬렉션:</b> musicbox<br>
                        <b>필수 정렬 필드:</b><br>
                        1. isPinned (내림차순)<br>
                        2. pinnedAt (내림차순)<br>
                        3. createdAt (내림차순)
                    </p>
                    ${indexLinkHtml}
                    <p class="text-xs mt-2">에러: ${error.message}</p>
                </div>`;
        } else {
            musicListContainer.innerHTML = '<p class="text-center text-red-500">음악 목록을 불러오는 데 실패했습니다: ' + error.message + '</p>';
        }
    }
}

// --- Event Listeners ---

// Login
loginButton.addEventListener('click', handleLogin);
passwordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleLogin();
    }
});

// FAB
fabButton.addEventListener('click', () => {
    fabOpen = !fabOpen;
    fabActions.classList.toggle('opacity-0', !fabOpen);
    fabActions.classList.toggle('pointer-events-none', !fabOpen);
    fabActions.classList.toggle('translate-y-4', !fabOpen);
    fabActions.classList.toggle('opacity-100', fabOpen);
    fabActions.classList.toggle('pointer-events-auto', fabOpen);
    fabActions.classList.toggle('translate-y-0', fabOpen);
    fabIconPlus.classList.toggle('hidden', fabOpen);
    fabIconClose.classList.toggle('hidden', !fabOpen);
});

openAddMusicFab.addEventListener('click', () => {
    openAddModal();
    if (fabOpen) fabButton.click();
});

logoutFab.addEventListener('click', async () => {
    if (fabOpen) fabButton.click();
    try {
        await signOut(auth);
    } catch (error) {
        console.error("로그아웃 실패:", error);
        alert("로그아웃 중 오류가 발생했습니다.");
    }
});

// Add Music Modal
closeAddMusicModalButton.addEventListener('click', closeAddModal);
cancelAddMusicButton.addEventListener('click', closeAddModal);
// addMusicModal.addEventListener('click', (event) => {
//     if (event.target === addMusicModal) closeAddModal();
// });
addMusicForm.addEventListener('submit', handleAddFormSubmit);


// Edit Music Modal
closeEditMusicModalButton.addEventListener('click', closeEditModal);
cancelEditMusicButton.addEventListener('click', closeEditModal);
// editMusicModal.addEventListener('click', (event) => {
//     if (event.target === editMusicModal) closeEditModal();
// });
editMusicForm.addEventListener('submit', handleEditFormSubmit);


// Global click listener for closing dropdown
document.addEventListener('click', (event) => {
    if (!event.target.closest('.admin-controls-container')) {
        closeAnyOpenDropdown();
    }
});

// Cmd+K for login mode switch
document.addEventListener('keydown', function (event) {
    const loginFormVisible = !loginFormContainer.classList.contains('hidden');
    if (loginFormVisible && !auth.currentUser && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (targetLoginEmail === REGULAR_ADMIN_EMAIL) {
            targetLoginEmail = SUPER_ADMIN_EMAIL;
            loginFormContainer.classList.replace('border-transparent', 'border-red-500');
        } else {
            targetLoginEmail = REGULAR_ADMIN_EMAIL;
            loginFormContainer.classList.replace('border-red-500', 'border-transparent');
        }
        setTimeout(() => {
            if (messageDiv.textContent.includes("로그인 모드")) messageDiv.textContent = "";
        }, 4000);
    }
});


// --- Logic Functions ---

async function handleLogin() {
    const passwordVal = passwordInput.value;
    const recaptchaResponse = (typeof grecaptcha !== 'undefined') ? grecaptcha.getResponse() : 'test_mode';

    if (!passwordVal || (!recaptchaResponse && typeof grecaptcha !== 'undefined')) {
        messageDiv.textContent = !passwordVal ? "비밀번호를 입력해주세요." : "reCAPTCHA를 완료해주세요.";
        messageDiv.className = "mt-4 text-sm text-center text-red-500";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "로그인 중...";
    const currentLoginMode = targetLoginEmail === SUPER_ADMIN_EMAIL ? '슈퍼 관리자' : '일반 관리자';
    messageDiv.textContent = `${currentLoginMode} 계정으로 로그인 시도 중...`;
    messageDiv.className = "mt-4 text-sm text-center text-gray-500";

    try {
        await signInWithEmailAndPassword(auth, targetLoginEmail, passwordVal);
        console.log(`${currentLoginMode} 로그인 성공!`);
    } catch (error) {
        console.error(`${currentLoginMode} 로그인 실패:`, error.code);
        messageDiv.textContent = `로그인 실패 (${currentLoginMode}): ${mapAuthError(error.code)}`;
        messageDiv.className = "mt-4 text-sm text-center text-red-600";
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "로그인";
    }
}

async function handleAddFormSubmit(event) {
    event.preventDefault();
    const saveMusicButton = document.getElementById('saveMusicButton');
    const addMusicMessage = document.getElementById('addMusicMessage');

    saveMusicButton.disabled = true;
    saveMusicButton.textContent = "저장 중...";
    addMusicMessage.textContent = "데이터를 저장하고 있습니다...";
    addMusicMessage.className = "mt-4 text-sm text-center text-gray-500";

    const formData = {
        title: addMusicForm.musicTitle.value.trim(),
        url: addMusicForm.musicUrl.value.trim(),
        description: addMusicForm.musicDescription.value.trim(),
        link1: addMusicForm.musicLink1.value.trim(),
        link2: addMusicForm.musicLink2.value.trim(),
    };

    const createdAtValue = addMusicForm.musicCreatedAt.value;
    const finalCreatedAt = createdAtValue ? new Date(createdAtValue) : serverTimestamp();

    if (!formData.title) {
        addMusicMessage.textContent = "곡 제목은 필수입니다.";
        addMusicMessage.className = "mt-4 text-sm text-center text-red-500";
        saveMusicButton.disabled = false;
        saveMusicButton.textContent = "저장";
        return;
    }

    try {
        await addDoc(collection(db, "musicbox"), {
            ...formData,
            createdAt: finalCreatedAt,
            userId: auth.currentUser ? auth.currentUser.uid : null,
            isPinned: false,
            pinnedAt: null
        });
        addMusicMessage.textContent = "음악이 성공적으로 추가되었습니다!";
        addMusicMessage.className = "mt-4 text-sm text-center text-green-500";
        setTimeout(() => {
            closeAddModal();
            loadAndDisplayMusicData();
        }, 1500);
    } catch (error) {
        console.error("데이터 저장 실패: ", error);
        addMusicMessage.textContent = "데이터 저장에 실패했습니다: " + error.message;
        addMusicMessage.className = "mt-4 text-sm text-center text-red-500";
    } finally {
        saveMusicButton.disabled = false;
        saveMusicButton.textContent = "저장";
    }
}





function mapAuthError(errorCode) {
    switch (errorCode) {
        case "auth/invalid-email": return "잘못된 이메일 형식입니다.";
        case "auth/user-disabled": return "사용 중지된 계정입니다.";
        case "auth/user-not-found": case "auth/wrong-password": case "auth/invalid-credential":
            return "비밀번호가 올바르지 않습니다.";
        case "auth/too-many-requests": return "너무 많은 요청이 있었습니다. 잠시 후 다시 시도해주세요.";
        case "auth/network-request-failed": return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
        case "auth/captcha-check-failed": return "reCAPTCHA 인증에 실패했습니다.";
        default: return "알 수 없는 오류가 발생했습니다. (" + errorCode + ")";
    }
}