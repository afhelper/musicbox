// musicbox.js (The Coordinator)

// --- 1. 모듈 임포트 ---
// 각자 자기 역할만 하는 모듈들을 모두 불러옵니다.
import { auth } from './firebase.js';
import * as config from './config.js';
import * as dom from './dom.js';
import { login, logout, onAuthChange, mapAuthError } from './auth.js';
import { initializeUI, updateUI, renderMusicList, closeAddModal, showAddModalMessage } from './ui.js';
import * as dataService from './firestore-service.js';


// --- 2. 애플리케이션 상태 관리 ---
// 이 파일은 앱의 핵심 상태(예: 로그인 모드)만 관리합니다.
let targetLoginEmail = config.REGULAR_ADMIN_EMAIL;


// --- 3. 핵심 로직 (핸들러 함수) ---
// UI 모듈에서 받은 이벤트를 실제 데이터 처리 로직과 연결하는 '핸들러'들입니다.

async function loadAndDisplayMusicData() {
    dom.musicListContainer.innerHTML = '<p class="text-center text-gray-500">음악 목록을 불러오는 중...</p>';
    try {
        const musicList = await dataService.getMusicList();
        ui.renderMusicList(musicList, { // UI 모듈에게 데이터 렌더링을 요청합니다.
            onDelete: handleDeleteAttempt,
            onPinToggle: handlePinToggleAttempt,
        });
    } catch (error) {
        console.error("음악 데이터 로드 실패:", error);
        dom.musicListContainer.innerHTML = `<p class="text-center text-red-500">음악 목록 로딩 실패: ${error.message}</p>`;
    }
}

async function handleLoginAttempt() {
    const password = dom.passwordInput.value;
    if (!password) {
        dom.messageDiv.textContent = "비밀번호를 입력해주세요.";
        return;
    }
    dom.loginButton.disabled = true;
    dom.loginButton.textContent = "로그인 중...";

    try {
        await login(targetLoginEmail, password);
    } catch (error) {
        dom.messageDiv.textContent = `로그인 실패: ${mapAuthError(error.code)}`;
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
    } finally {
        dom.loginButton.disabled = false;
        dom.loginButton.textContent = "로그인";
    }
}

async function handleLogoutAttempt() {
    try {
        await logout();
    } catch (error) {
        alert('로그아웃 중 오류가 발생했습니다.');
        console.error(error);
    }
}

// musicbox.js

// ... (다른 핸들러 함수는 그대로) ...

async function handleSaveMusicAttempt() {
    const title = dom.addMusicForm.musicTitle.value.trim();
    if (!title) {
        // 새로 만든 메시지 함수 사용
        ui.showAddModalMessage("곡 제목은 필수입니다.", false);
        return;
    }
    dom.saveMusicButton.disabled = true;
    dom.saveMusicButton.textContent = "저장 중...";

    const newMusic = {
        title: title,
        url: dom.addMusicForm.musicUrl.value.trim(),
        description: dom.addMusicForm.musicDescription.value.trim(),
        link1: dom.addMusicForm.musicLink1.value.trim(),
        link2: dom.addMusicForm.musicLink2.value.trim(),
        userId: auth.currentUser ? auth.currentUser.uid : null,
    };

    try {
        await dataService.addMusic(newMusic);
        // 🔽 성공 메시지를 표시하는 로직 추가
        ui.showAddModalMessage("음악이 성공적으로 추가되었습니다!");

        // 🔽 1.5초 후에 모달을 '닫도록' 수정
        setTimeout(() => {
            ui.closeAddModal();
            loadAndDisplayMusicData();
        }, 1500); // 1.5초로 변경
    } catch (error) {
        // 새로 만든 메시지 함수 사용
        ui.showAddModalMessage(`저장 실패: ${error.message}`, false);
    } finally {
        // setTimeout이 실행되는 동안 버튼이 다시 활성화되지 않도록
        // 이 로직은 성공 시에는 setTimeout 안으로 옮겨주는게 더 좋지만,
        // 일단은 원래 구조를 유지할게.
        dom.saveMusicButton.disabled = false;
        dom.saveMusicButton.textContent = "저장";
    }
}

// ... (이하 다른 핸들러 함수는 그대로) ...

async function handleUpdateMusicAttempt(docId) {
    const title = dom.editMusicTitleInput.value.trim();
    if (!title) {
        dom.editMusicMessage.textContent = "곡 제목은 필수입니다.";
        return;
    }
    dom.updateMusicButton.disabled = true;

    const updatedMusic = {
        title: title,
        url: dom.editMusicUrlInput.value.trim(),
        description: dom.editMusicDescriptionInput.value.trim(),
        link1: dom.editMusicLink1Input.value.trim(),
        link2: dom.editMusicLink2Input.value.trim(),
    };

    try {
        await dataService.updateMusic(docId, updatedMusic);
        setTimeout(() => {
            // 모달 닫기는 UI 모듈에 구현되어 있지만, 여기서 직접 호출하기보다
            // ui.closeEditModal() 같은 함수를 만들어 호출하는 것이 더 이상적입니다.
            // 여기서는 편의상 로직을 유지합니다.
            document.getElementById('editMusicModal').classList.add('hidden');
            document.body.classList.remove('modal-active');
            loadAndDisplayMusicData();
        }, 1000);
    } catch (error) {
        dom.editMusicMessage.textContent = `업데이트 실패: ${error.message}`;
    } finally {
        dom.updateMusicButton.disabled = false;
    }
}


function handleDeleteAttempt(docId, title) {
    if (confirm(`"${title}" 음악을 정말 삭제하시겠습니까?`)) {
        dataService.deleteMusic(docId).then(() => {
            alert(`"${title}"이(가) 삭제되었습니다.`);
            loadAndDisplayMusicData();
        }).catch(error => {
            alert(`삭제 중 오류 발생: ${error.message}`);
        });
    }
}

function handlePinToggleAttempt(docId, newPinStatus) {
    dataService.togglePinStatus(docId, newPinStatus)
        .then(() => loadAndDisplayMusicData())
        .catch(error => alert(`상태 변경 중 오류 발생: ${error.message}`));
}

function handleToggleLoginMode() {
    if (targetLoginEmail === config.REGULAR_ADMIN_EMAIL) {
        targetLoginEmail = config.SUPER_ADMIN_EMAIL;
        dom.passwordInput.type = "password";
        dom.messageDiv.textContent = "🔒 슈퍼 관리자 로그인 모드";
    } else {
        targetLoginEmail = config.REGULAR_ADMIN_EMAIL;
        dom.passwordInput.type = "text";
        dom.messageDiv.textContent = "일반 관리자 로그인 모드";
    }
}


// --- 4. 애플리케이션 초기화 ---
// 앱이 시작될 때 모든 것을 연결하고 실행합니다.

// 로그인 상태가 바뀔 때마다 UI를 업데이트하고, 로그인했다면 데이터를 불러옵니다.
onAuthChange(user => {
    ui.updateUI(user, loadAndDisplayMusicData);
});

// UI 모듈을 초기화하고, 각 이벤트에 맞는 핸들러 함수들을 '콜백'으로 전달합니다.
ui.initializeUI({
    onLogin: handleLoginAttempt,
    onLogout: handleLogoutAttempt,
    onSaveMusic: handleSaveMusicAttempt,
    onUpdateMusic: handleUpdateMusicAttempt,
    onToggleLoginMode: handleToggleLoginMode
});