// app.js
import {
    auth, db, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    collection, addDoc, query, orderBy, getDocs, serverTimestamp, limit, startAfter
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

// 👇 페이지네이션을 위한 전역 변수 추가
let lastVisibleDoc = null; // 마지막으로 불러온 문서를 추적
let isLoading = false;     // 중복 로딩 방지 플래그
const PAGE_SIZE = 10;      // 한 번에 불러올 문서 수

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
    if (user) { // 로그인 시
        loginFormContainer.classList.add('hidden');
        fabContainer.classList.remove('hidden');
        dataSectionDiv.classList.remove('hidden');

        // 👇 [수정됨] 첫 로딩임을 명시적으로 알려주기 위해 true를 전달
        loadAndDisplayMusicData(true);

        passwordInput.value = "";
        passwordInput.type = "password";
        targetLoginEmail = REGULAR_ADMIN_EMAIL;
        if (messageDiv && messageDiv.textContent.includes("로그인 모드")) {
            messageDiv.textContent = "";
        }
    } else { // 로그아웃 시
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

        // 👇 [추가됨] 로그아웃 시 페이지네이션 상태를 깨끗하게 초기화
        lastVisibleDoc = null;
        isLoading = false;
    }
}

// --- Data Loading ---

export async function loadAndDisplayMusicData(isInitialLoad = false) {
    // 로딩 중이거나, 첫 로드가 아닌데 더 불러올 문서가 없으면 중단
    if (isLoading || (!isInitialLoad && !lastVisibleDoc)) {
        return;
    }
    if (!auth.currentUser) return;

    isLoading = true;
    scrollTrigger.innerHTML = '<div class="spinner"></div>'; // 로딩 시작, 스피너 표시

    // 첫 로딩일 경우, 기존 목록을 비우고 상태 초기화
    if (isInitialLoad) {
        musicListContainer.innerHTML = '';
        lastVisibleDoc = null;
    }

    try {
        const musicCollectionRef = collection(db, "musicbox");
        let q = query(musicCollectionRef,
            orderBy("isPinned", "desc"),
            orderBy("pinnedAt", "desc"),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
        );

        // 첫 로딩이 아닐 경우, 마지막 문서 다음부터 쿼리
        if (!isInitialLoad && lastVisibleDoc) {
            q = query(q, startAfter(lastVisibleDoc));
        }

        const querySnapshot = await getDocs(q);

        if (isInitialLoad && querySnapshot.empty) {
            musicListContainer.innerHTML = '<p class="text-center text-gray-500">아직 등록된 음악이 없어요. 첫 곡을 추가해보세요!</p>';
            scrollTrigger.innerHTML = ''; // 내용 없으면 스피너도 제거
            isLoading = false;
            return;
        }

        querySnapshot.forEach((docSnapshot) => {
            const music = docSnapshot.data();
            const musicElement = createMusicItemElement(docSnapshot.id, music, auth.currentUser, YOUR_SUPER_ADMIN_UID);
            musicListContainer.appendChild(musicElement); // 기존 목록에 추가(append)
        });

        // 마지막 문서를 저장해 다음 페이지 쿼리에 사용
        lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        // 불러온 문서 수가 PAGE_SIZE보다 작으면 더 이상 데이터가 없는 것
        if (querySnapshot.docs.length < PAGE_SIZE) {
            lastVisibleDoc = null; // 더 이상 가져올 데이터 없음을 표시
        }

    } catch (error) {
        console.error("음악 데이터 로드 실패:", error);
        // ... 기존 에러 처리 로직을 여기에 넣어도 됨
        musicListContainer.innerHTML += '<p class="text-center text-red-500">목록을 불러오는 데 실패했습니다.</p>';
    } finally {
        isLoading = false;
        scrollTrigger.innerHTML = ''; // 로딩 완료, 스피너 제거
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


// --- IntersectionObserver for Infinite Scrolling ---
const observer = new IntersectionObserver((entries) => {
    // entries[0]가 화면에 보이고(isIntersecting), 로딩 중이 아닐 때 데이터 로드
    if (entries[0].isIntersecting && !isLoading) {
        loadAndDisplayMusicData(false); // isInitialLoad = false
    }
}, {
    rootMargin: '0px',
    threshold: 0.1 // 트리거 요소가 10%만 보여도 콜백 실행
});

// scrollTrigger 요소 감시 시작
observer.observe(scrollTrigger);



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