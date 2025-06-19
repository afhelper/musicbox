// ui.js
import { auth } from './firebase.js';
import { YOUR_SUPER_ADMIN_UID } from './config.js';
import * as dom from './dom.js';

// UI 상태를 관리하는 변수
let fabOpen = false;
let currentOpenDropdown = null;
let currentEditingDocId = null;

// --- Helper Functions ---

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getYouTubeVideoInfo(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;
        let videoId = null;
        let isShorts = false;

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            if (hostname.includes('youtu.be')) {
                videoId = pathname.substring(1).split(/[?#]/)[0];
            } else if (pathname === '/watch') {
                videoId = urlObj.searchParams.get('v');
            } else if (pathname.startsWith('/embed/')) {
                videoId = pathname.substring('/embed/'.length).split(/[?#]/)[0];
            } else if (pathname.startsWith('/shorts/')) {
                videoId = pathname.substring('/shorts/'.length).split(/[?#]/)[0];
                isShorts = true;
            }
        }

        if (videoId) {
            return { videoId: videoId, isShorts: isShorts, embedUrl: `https://www.youtube.com/embed/${videoId}` };
        }
    } catch (e) {
        console.warn("URL에서 YouTube 정보 추출 중 오류:", url, e);
    }
    return null;
}


// --- Modal & FAB Control ---

function toggleFab() {
    fabOpen = !fabOpen;
    if (fabOpen) {
        dom.fabActions.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
        dom.fabActions.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
        dom.fabIconPlus.classList.add('hidden');
        dom.fabIconClose.classList.remove('hidden');
    } else {
        dom.fabActions.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
        dom.fabActions.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
        dom.fabIconPlus.classList.remove('hidden');
        dom.fabIconClose.classList.add('hidden');
    }
}

function closeAnyOpenDropdown(excludeMenu = null) {
    if (currentOpenDropdown && currentOpenDropdown !== excludeMenu) {
        currentOpenDropdown.remove();
        currentOpenDropdown = null;
    }
}

export function openAddModal() {
    dom.addMusicForm.reset();
    dom.addMusicMessage.textContent = '';
    dom.addMusicModal.classList.remove('hidden');
    document.body.classList.add('modal-active');
}
export function closeAddModal() {
    dom.addMusicModal.classList.add('hidden');
    document.body.classList.remove('modal-active');
}
export function showAddModalMessage(message, isSuccess = true) {
    dom.addMusicMessage.textContent = message;
    dom.addMusicMessage.className = isSuccess
        ? 'mt-4 text-sm text-center text-green-500' // 성공 시 초록색
        : 'mt-4 text-sm text-center text-red-500';  // 실패 시 빨간색
}

function closeAddModal() {
    dom.addMusicModal.classList.add('hidden');
    document.body.classList.remove('modal-active');
}

function openEditModal(docId, musicData) {
    currentEditingDocId = docId;
    dom.editMusicIdInput.value = docId;
    dom.editMusicTitleInput.value = musicData.title || '';
    dom.editMusicUrlInput.value = musicData.url || '';
    dom.editMusicDescriptionInput.value = musicData.description || '';
    dom.editMusicLink1Input.value = musicData.link1 || '';
    dom.editMusicLink2Input.value = musicData.link2 || '';

    dom.editMusicMessage.textContent = '';
    dom.editMusicModal.classList.remove('hidden');
    document.body.classList.add('modal-active');
}

function closeEditModal() {
    currentEditingDocId = null;
    dom.editMusicModal.classList.add('hidden');
    document.body.classList.remove('modal-active');
}

// --- Main UI Rendering ---

function createMusicItemElement(id, music, callbacks) {
    const div = document.createElement('div');
    div.className = "music-item bg-gray-50 p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200";
    div.dataset.id = id;

    // ... (playerHtml, linkHtml 로직은 원본과 동일)
    // 여기서는 생략하고, 원본 musicbox.js의 createMusicItemElement 내부 로직을 그대로 복사해오면 돼.
    // ...
    let playerHtml = '';
    const musicUrl = music.url;

    if (musicUrl) {
        const isAudioFile = /\.(mp3|m4a|ogg|wav|aac)$/i.test(musicUrl);
        const mainVideoInfo = getYouTubeVideoInfo(musicUrl);

        if (isAudioFile) {
            let audioType = '';
            if (/\.mp3$/i.test(musicUrl)) audioType = 'audio/mpeg';
            else if (/\.(m4a|aac)$/i.test(musicUrl)) audioType = 'audio/mp4';
            else if (/\.ogg$/i.test(musicUrl)) audioType = 'audio/ogg';
            else if (/\.wav$/i.test(musicUrl)) audioType = 'audio/wav';
            playerHtml = `
                <div class="my-3">
                    <audio controls preload="none" class="w-full rounded">
                        <source src="${musicUrl}" ${audioType ? `type="${audioType}"` : ''}>
                        브라우저가 오디오 재생을 지원하지 않습니다. <a href="${musicUrl}" target="_blank" class="text-indigo-500 hover:underline">직접 듣기</a>
                    </audio>
                </div>`;
        } else if (mainVideoInfo) {
            const embedContainerClass = mainVideoInfo.isShorts ? 'youtube-shorts-container' : 'aspect-w-16 aspect-h-9';
            playerHtml = `
                <div class="${embedContainerClass} my-3 rounded overflow-hidden">
                    <iframe src="${mainVideoInfo.embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                </div>`;
        } else {
            playerHtml = `<div class="my-3"><a href="${musicUrl}" target="_blank" class="text-indigo-600 hover:text-indigo-800 hover:underline break-all">콘텐츠 보기/듣기: ${escapeHtml(musicUrl)}</a></div>`;
        }
    } else {
        playerHtml = `<div class="my-3"><p class="text-sm text-gray-500">제공된 음악 URL이 없습니다.</p></div>`;
    }

    function createLinkHtml(linkUrl, linkNumber) {
        // ... (이 함수도 원본 그대로 복사)
        let html = '';
        if (linkUrl) {
            const videoInfo = getYouTubeVideoInfo(linkUrl);

            const chainIconSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-500">
              <path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>`;

            const firstLineHtml = `
            <div class="flex items-center space-x-1">
                ${chainIconSvg}
                <span class="text-sm font-medium text-gray-700">#${linkNumber}</span>
            </div>`;

            if (videoInfo) {
                const embedContainerClass = videoInfo.isShorts ? 'youtube-shorts-container' : 'aspect-w-16 aspect-h-9';
                const youtubeIconSvg = `
                <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current text-red-600 transition-colors">
                    <title>YouTube</title>
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>`;
                const shortsBadge = videoInfo.isShorts ? '<span class="text-xs bg-gray-200 text-black-700 px-1.5 py-0.5 rounded-full font-semibold">Shorts</span>' : '';
                let secondLineIconsHtml = shortsBadge ? `<div class="flex items-center space-x-1.5 mt-1">${youtubeIconSvg}${shortsBadge}</div>` : `<div class="flex items-center mt-1">${youtubeIconSvg}</div>`;

                html = `
                <div class="mt-3">
                    <div class="mb-2"> 
                        ${firstLineHtml}
                        ${secondLineIconsHtml}
                    </div>
                    <div class="${embedContainerClass} rounded overflow-hidden shadow-sm">
                        <iframe src="${videoInfo.embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                    </div>
                </div>`;
            } else {
                const linkIdentifierWithColonHtml = `<div class="flex items-center space-x-1">${chainIconSvg}<span class="text-sm font-medium text-gray-700">#${linkNumber}</span></div>`;
                html = `
                <div class="mt-3">
                    <div class="mb-2">${linkIdentifierWithColonHtml}</div>
                    <a href="${linkUrl}" target="_blank" class="text-sm text-blue-500 hover:underline break-all block pl-5">${escapeHtml(linkUrl)}</a>
                </div>`;
            }
        }
        return html;
    }


    const safeTitle = escapeHtml(music.title || '제목 없음');
    const safeDescription = music.description ? `<p class="text-sm text-gray-600 my-3 whitespace-pre-wrap">${escapeHtml(music.description)}</p>` : '';
    const link1Html = createLinkHtml(music.link1 || '', 1);
    const link2Html = createLinkHtml(music.link2 || '', 2);

    let pinnedIndicatorHtml = '';
    if (music.isPinned === true) {
        pinnedIndicatorHtml = `
        <div class="absolute -top-1 -left-1 bg-blue-400 text-white w-5 h-5 rounded-full shadow flex items-center justify-center" title="고정됨">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
            </svg>
        </div>`;
    }

    div.innerHTML = `
        ${pinnedIndicatorHtml}
        <h4 class="text-xl font-semibold text-blue-700 mb-1 pt-1">${safeTitle}</h4>
        ${playerHtml}
        ${safeDescription}
        ${link1Html}
        ${link2Html}
        <p class="text-xs text-gray-400 mt-4 text-right">게시일: ${music.createdAt ? new Date(music.createdAt.seconds * 1000).toLocaleString() : '날짜 정보 없음'}</p>
    `;

    if (auth.currentUser && auth.currentUser.uid === YOUR_SUPER_ADMIN_UID) {
        addAdminControls(div, id, music, callbacks);
    }
    return div;
}

function addAdminControls(itemElement, musicId, musicData, callbacks) {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'admin-controls-container';

    const moreButton = document.createElement('button');
    moreButton.className = 'more-options-button';
    moreButton.title = '더 보기';
    moreButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
    `;

    const dropdownMenu = createDropdownMenu(musicId, musicData, callbacks);

    moreButton.addEventListener('click', (event) => {
        event.stopPropagation();
        closeAnyOpenDropdown(dropdownMenu);
        // 드롭다운 메뉴를 토글
        const isCurrentlyOpen = !!moreButton.parentNode.querySelector('.dropdown-menu');
        if (isCurrentlyOpen) {
            dropdownMenu.remove();
        } else {
            moreButton.parentNode.appendChild(dropdownMenu);
        }
        currentOpenDropdown = isCurrentlyOpen ? null : dropdownMenu;
    });

    controlsContainer.appendChild(moreButton);
    itemElement.appendChild(controlsContainer);
}

function createDropdownMenu(musicId, musicData, callbacks) {
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';

    const isCurrentlyPinned = musicData.isPinned === true;

    const pinButton = document.createElement('button');
    pinButton.textContent = isCurrentlyPinned ? '고정 해제' : '고정하기';
    pinButton.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onPinToggle(musicId, !isCurrentlyPinned); // '고정 토글' 콜백 호출
        closeAnyOpenDropdown();
    });

    const editButton = document.createElement('button');
    editButton.textContent = '수정';
    editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(musicId, musicData); // 수정 모달은 여기서 직접 열어도 괜찮아.
        closeAnyOpenDropdown();
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '삭제';
    deleteButton.className = 'delete-option';
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onDelete(musicId, musicData.title); // '삭제' 콜백 호출
        closeAnyOpenDropdown();
    });

    menu.appendChild(pinButton);
    menu.appendChild(editButton);
    menu.appendChild(deleteButton);
    return menu;
}

export function renderMusicList(musicList, callbacks) {
    dom.musicListContainer.innerHTML = '';
    if (!musicList || musicList.length === 0) {
        dom.musicListContainer.innerHTML = '<p class="text-center text-gray-500">아직 등록된 음악이 없어요. 첫 곡을 추가해보세요!</p>';
        return;
    }
    musicList.forEach(musicDoc => {
        const musicElement = createMusicItemElement(musicDoc.id, musicDoc.data, callbacks);
        dom.musicListContainer.appendChild(musicElement);
    });
}

export function updateUI(user, loadAndDisplayMusicData) {
    if (user) {
        dom.loginFormContainer.classList.add('hidden');
        dom.fabContainer.classList.remove('hidden');
        dom.dataSectionDiv.classList.remove('hidden');
        loadAndDisplayMusicData(); // 콜백으로 받은 데이터 로딩 함수 실행

        dom.passwordInput.value = "";
        dom.messageDiv.textContent = "";

    } else {
        dom.loginFormContainer.classList.remove('hidden');
        dom.fabContainer.classList.add('hidden');
        dom.dataSectionDiv.classList.add('hidden');
        dom.musicListContainer.innerHTML = '';

        dom.passwordInput.value = "";
        dom.passwordInput.type = "text";
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();

        if (fabOpen) toggleFab();
        closeAnyOpenDropdown();
    }
}


// --- Event Listener Setup ---

/**
 * 모든 UI 이벤트 리스너를 초기화하는 함수
 * @param {object} callbacks - 각 이벤트에 대한 콜백 함수 모음
 */
export function initializeUI(callbacks) {
    dom.loginButton.addEventListener('click', callbacks.onLogin);
    dom.passwordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            callbacks.onLogin();
        }
    });

    // FAB
    dom.fabButton.addEventListener('click', toggleFab);
    dom.openAddMusicFab.addEventListener('click', () => {
        openAddModal();
        if (fabOpen) toggleFab();
    });
    dom.logoutFab.addEventListener('click', () => {
        if (fabOpen) toggleFab();
        callbacks.onLogout();
    });

    // Add Modal
    dom.closeAddMusicModalButton.addEventListener('click', closeAddModal);
    dom.cancelAddMusicButton.addEventListener('click', closeAddModal);
    dom.addMusicModal.addEventListener('click', (e) => { if (e.target === dom.addMusicModal) closeAddModal(); });
    dom.addMusicForm.addEventListener('submit', (e) => {
        e.preventDefault();
        callbacks.onSaveMusic(); // 저장 콜백 호출
    });


    // Edit Modal
    dom.closeEditMusicModalButton.addEventListener('click', closeEditModal);
    dom.cancelEditMusicButton.addEventListener('click', closeEditModal);
    dom.editMusicModal.addEventListener('click', (e) => { if (e.target === dom.editMusicModal) closeEditModal(); });
    dom.editMusicForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentEditingDocId) {
            callbacks.onUpdateMusic(currentEditingDocId); // 업데이트 콜백 호출
        }
    });

    // Global click listener for dropdowns
    document.addEventListener('click', (event) => {
        if (currentOpenDropdown && !event.target.closest('.more-options-button')) {
            closeAnyOpenDropdown();
        }
    });

    // Cmd+K shortcut listener
    document.addEventListener('keydown', (event) => {
        const loginFormVisible = !dom.loginFormContainer.classList.contains('hidden');
        if (loginFormVisible && !auth.currentUser && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            callbacks.onToggleLoginMode(); // 로그인 모드 전환 콜백 호출
        }
    });
}
