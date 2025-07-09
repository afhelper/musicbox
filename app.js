// app.js
import {
    auth, db, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    collection, addDoc, query, orderBy, getDocs, serverTimestamp, limit, startAfter, where, doc, getDoc
} from './firebase.js';

import {
    createMusicItemElement,
    openAddModal, closeAddModal,
    openEditModal, closeEditModal, handleEditFormSubmit,
    closeAnyOpenDropdown, showToast
} from './ui.js';

// --- Constants ---
const REGULAR_ADMIN_EMAIL = "admin@admin.com";
const SUPER_ADMIN_EMAIL = "super_admin@admin.com";
const YOUR_SUPER_ADMIN_UID = "8ix4GhF65ENqR6nVB6VrH3n4qJy2";
let targetLoginEmail = REGULAR_ADMIN_EMAIL;
// 👇 [2단계-2] 전역 변수 추가
let currentSearchTerm = null; // 현재 검색어를 저장할 변수

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
// 👇 [2단계-3] 새로 추가한 DOM 요소 가져오기
const searchInput = document.getElementById('searchInput');
const clearSearchButton = document.getElementById('clearSearchButton');

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

        // 👇 [수정] URL 해시를 확인하는 로직 추가
        handleUrlHash();

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
// musicbox/app.js

export async function loadAndDisplayMusicData(isInitialLoad = false, searchTerm = null) {
    // 👇 바로 이 부분이야!
    if (isLoading || (!isInitialLoad && !lastVisibleDoc)) {
        return;
    }
    if (!auth.currentUser) return;

    isLoading = true;
    scrollTrigger.innerHTML = '<div class="spinner"></div>';

    if (isInitialLoad) {
        musicListContainer.innerHTML = '';
        lastVisibleDoc = null;
    }

    try {
        const musicCollectionRef = collection(db, "musicbox");
        let q;

        if (searchTerm) {
            q = query(musicCollectionRef,
                where("keywords", "array-contains", searchTerm.toLowerCase()),
                limit(PAGE_SIZE)
            );
        } else {
            q = query(musicCollectionRef,
                orderBy("isPinned", "desc"),
                orderBy("pinnedAt", "desc"),
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE)
            );
        }

        if (!isInitialLoad && lastVisibleDoc) {
            q = query(q, startAfter(lastVisibleDoc));
        }

        const querySnapshot = await getDocs(q);

        if (isInitialLoad && querySnapshot.empty) {
            musicListContainer.innerHTML = searchTerm
                ? `<p class="text-center text-gray-500">'${searchTerm}'에 대한 검색 결과가 없습니다.</p>`
                : '<p class="text-center text-gray-500">아직 등록된 음악이 없어요. 첫 곡을 추가해보세요!</p>';
            scrollTrigger.innerHTML = '';
            isLoading = false;
            lastVisibleDoc = null;
            return;
        }

        querySnapshot.forEach((docSnapshot) => {
            const music = docSnapshot.data();
            const musicElement = createMusicItemElement(docSnapshot.id, music, auth.currentUser, YOUR_SUPER_ADMIN_UID);
            musicListContainer.appendChild(musicElement);
        });

        const lastDocInPage = querySnapshot.docs[querySnapshot.docs.length - 1];

        if (querySnapshot.docs.length < PAGE_SIZE) {
            lastVisibleDoc = null;
        } else {
            lastVisibleDoc = lastDocInPage;
        }

    } catch (error) {
        console.error("음악 데이터 로드 실패:", error);
        musicListContainer.innerHTML += '<p class="text-center text-red-500">목록을 불러오는 데 실패했습니다.</p>';
    } finally {
        isLoading = false;

        // 👇 finally 블록을 이렇게 수정
        if (lastVisibleDoc) {
            // 아직 불러올 페이지가 남았으면, 스피너를 위해 공간을 비워둠
            scrollTrigger.innerHTML = '';
        } else {
            // 더 이상 불러올 페이지가 없으면, 마지막임을 알리는 메시지 표시
            // musicListContainer에 자식이 하나라도 있을 때만 메시지를 표시
            if (musicListContainer.children.length > 0) {
                scrollTrigger.innerHTML = '<p class="text-sm text-center text-gray-500 pt-6">마지막 페이지입니다.</p>';
            } else {
                // 목록이 아예 비어있으면 아무것도 표시하지 않음
                scrollTrigger.innerHTML = '';
            }
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

musicListContainer.addEventListener('play', (event) => {
    // 이벤트가 발생한 타겟이 AUDIO 태그인지 확인
    if (event.target.tagName === 'AUDIO') {
        // 1. 모든 항목에서 'now-playing' 클래스를 먼저 제거 (하이라이트 초기화)
        const allMusicItems = musicListContainer.querySelectorAll('.music-item');
        allMusicItems.forEach(item => {
            item.classList.remove('now-playing');
        });

        // 2. 현재 재생된 오디오의 부모(.music-item)를 찾아 'now-playing' 클래스 추가
        const currentMusicItem = event.target.closest('.music-item');
        if (currentMusicItem) {
            currentMusicItem.classList.add('now-playing');
        }

        // 3. 다른 오디오가 재생중이면 멈추는 기존 로직
        const allAudioElements = musicListContainer.querySelectorAll('audio');
        allAudioElements.forEach(audio => {
            if (audio !== event.target && !audio.paused) {
                audio.pause();
            }
        });
    }
}, true); // 이벤트 캡처링 사용

const handleAudioStop = (event) => {
    if (event.target.tagName === 'AUDIO') {
        const musicItem = event.target.closest('.music-item');
        if (musicItem) {
            musicItem.classList.remove('now-playing');
        }
    }
};

// 👇 [수정] 두 이벤트에 동일한 함수를 연결
musicListContainer.addEventListener('pause', handleAudioStop, true);
musicListContainer.addEventListener('ended', handleAudioStop, true);


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


// 👇 [2단계-5] 검색 관련 이벤트 리스너 추가
searchInput.addEventListener('keydown', (e) => {
    // 'Enter' 키를 눌렀을 때
    if (e.key === 'Enter') {
        // 앞뒤 공백을 제거한 검색어를 가져옴
        const searchTerm = searchInput.value.trim();

        // 검색어가 있을 경우, 검색을 실행
        if (searchTerm) {
            currentSearchTerm = searchTerm;
            clearSearchButton.classList.remove('hidden'); // X 버튼 보이기
            loadAndDisplayMusicData(true, currentSearchTerm); // 새로운 검색어로 데이터 로드
        } else {
            // 검색어가 비어있을 때 Enter를 누르면 검색 취소
            // X 버튼의 클릭 이벤트를 강제로 실행시켜 코드를 재사용
            clearSearchButton.click();
        }
    }
    // 'Escape' 키를 눌렀을 때
    else if (e.key === 'Escape') {
        // 검색을 취소하고 전체 목록으로 돌아감
        clearSearchButton.click(); // 마찬가지로 X 버튼 클릭을 실행
    }
});


clearSearchButton.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchTerm = null;
    clearSearchButton.classList.add('hidden'); // X 버튼 숨기기
    loadAndDisplayMusicData(true); // 전체 목록 다시 불러오기
});


openAddMusicFab.addEventListener('click', () => {
    openAddModal();
    if (fabOpen) fabButton.click();
});

logoutFab.addEventListener('click', async () => {
    if (fabOpen) fabButton.click();
    try {
        await signOut(auth);
        showToast("로그아웃 되었습니다.", "success");
    } catch (error) {
        console.error("로그아웃 실패:", error);
        showToast("로그아웃 중 오류가 발생했습니다.");
    }
});


// 👇 [추가] 로고 클릭 이벤트 처리
const logoLink = document.getElementById('logoLink');
if (logoLink) {
    logoLink.addEventListener('click', (event) => {
        event.preventDefault(); // a 태그의 기본 동작(페이지 상단 이동) 방지

        // 현재 단일 게시물 보기 상태일 때 (#post/...)
        if (window.location.hash.startsWith('#post/')) {
            // URL에서 해시를 제거해서 목록으로 돌아가도록 신호를 보냄
            history.pushState("", document.title, window.location.pathname + window.location.search);

            // 숨겼던 UI들을 다시 표시
            searchInput.parentElement.classList.remove('hidden');
            scrollTrigger.style.display = 'block';

            // 목록을 다시 로드하는 함수 호출
            handleUrlHash();
        }
        // 일반 목록 보기 상태일 때
        else {
            // 단순히 목록을 맨 위에서부터 새로고침
            loadAndDisplayMusicData(true);
        }
    });
}


// --- IntersectionObserver for Infinite Scrolling ---

// 👇 [2단계-6] 무한 스크롤 시 검색 상태를 유지하도록 수정
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading) {
        // currentSearchTerm을 인자로 넘겨주어 검색 상태에서도 무한스크롤이 동작하게 함
        loadAndDisplayMusicData(false, currentSearchTerm);
    }
}, {
    rootMargin: '0px',
    threshold: 0.1
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
    // 👇 [1단계-1] 제목을 키워드로 분해해서 같이 저장하기
    const keywords = formData.title.toLowerCase().split(' ').filter(word => word.length > 0);
    try {
        await addDoc(collection(db, "musicbox"), {
            ...formData,
            keywords: keywords,
            createdAt: finalCreatedAt,
            userId: auth.currentUser ? auth.currentUser.uid : null,
            isPinned: false,
            pinnedAt: null
        });
        addMusicMessage.textContent = "음악이 성공적으로 추가되었습니다!";
        addMusicMessage.className = "mt-4 text-sm text-center text-green-500";
        setTimeout(() => {
            closeAddModal();
            loadAndDisplayMusicData(true);
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

// 👇 [추가] URL 해시 변경을 감지하고 처리하는 함수
function handleUrlHash() {
    const hash = window.location.hash;
    // URL에 #post/ID 형태의 값이 있는지 확인
    if (hash.startsWith('#post/')) {
        const postId = hash.substring(6); // '#post/' 다음의 ID 값 추출
        loadSinglePost(postId);
    } else {
        // 해시가 없으면 전체 목록을 불러옴
        musicListContainer.style.display = 'block'; // 목록 컨테이너 보이기
        scrollTrigger.style.display = 'block'; // 무한 스크롤 트리거 보이기
        fabContainer.classList.remove('hidden');
        loadAndDisplayMusicData(true, currentSearchTerm);
    }
}

// 👇 [추가] 단일 게시물 데이터만 불러와서 표시하는 함수


async function loadSinglePost(postId) {
    if (isLoading) return;
    isLoading = true;
    musicListContainer.innerHTML = '<div class="spinner"></div>'; // 로딩 스피너 표시

    // 단일 게시물이므로 무한 스크롤과 검색창은 숨김
    scrollTrigger.style.display = 'none';
    searchInput.parentElement.classList.add('hidden');
    fabContainer.classList.add('hidden');

    try {
        const docRef = doc(db, "musicbox", postId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            musicListContainer.innerHTML = ''; // 스피너 제거
            const music = docSnap.data();
            const musicElement = createMusicItemElement(docSnap.id, music, auth.currentUser, YOUR_SUPER_ADMIN_UID);

            // "목록으로 돌아가기" 버튼 없이 게시물 요소만 바로 추가
            musicListContainer.appendChild(musicElement);

        } else {
            console.log("해당 ID의 문서를 찾을 수 없습니다.");
            musicListContainer.innerHTML = '<p class="text-center text-red-500">해당 게시물을 찾을 수 없습니다. 삭제되었거나 잘못된 주소입니다.</p>';
        }
    } catch (error) {
        console.error("단일 게시물 로드 실패:", error);
        musicListContainer.innerHTML = '<p class="text-center text-red-500">게시물을 불러오는 데 실패했습니다.</p>';
    } finally {
        isLoading = false;
    }
}

// 👇 [추가] 브라우저의 뒤로/앞으로 가기 버튼을 눌렀을 때도 URL을 확인하도록 이벤트 리스너 추가
window.addEventListener('hashchange', handleUrlHash);