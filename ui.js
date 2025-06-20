// ui.js
import { db, doc, updateDoc, deleteDoc, serverTimestamp } from './firebase.js';
import { loadAndDisplayMusicData } from './app.js'; // 순환 참조를 피하기 위해 app.js에서 함수를 가져옴

let currentOpenDropdown = null;
let currentEditingDocId = null;

// --- DOM Elements ---
const musicListContainer = document.getElementById('musicListContainer');
const addMusicModal = document.getElementById('addMusicModal');
const addMusicForm = document.getElementById('addMusicForm');
const addMusicMessage = document.getElementById('addMusicMessage');
const saveMusicButton = document.getElementById('saveMusicButton');
const editMusicModal = document.getElementById('editMusicModal');
const editMusicForm = document.getElementById('editMusicForm');
const editMusicMessage = document.getElementById('editMusicMessage');
const editMusicIdInput = document.getElementById('editMusicId');
const editMusicTitleInput = document.getElementById('editMusicTitle');
const editMusicUrlInput = document.getElementById('editMusicUrl');
const editMusicDescriptionInput = document.getElementById('editMusicDescription');
const editMusicLink1Input = document.getElementById('editMusicLink1');
const editMusicLink2Input = document.getElementById('editMusicLink2');

// --- Helper Functions ---
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatToDateTimeLocalString(date) {
    if (!date) return '';
    // 한국 시간(UTC+9)에 맞춰 표시되도록 시간 보정
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffset);
    return localDate.toISOString().slice(0, 16);
}

function getYouTubeVideoInfo(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;
        let videoId = null;
        let isShorts = false;

        // 구글usercontent URL 형식과 표준 YouTube URL 형식을 모두 처리
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be') || hostname.includes('googleusercontent.com')) {
            if (hostname.includes('youtu.be')) {
                videoId = pathname.substring(1).split(/[?#]/)[0];
            } else if (pathname === '/watch') {
                videoId = urlObj.searchParams.get('v');
            } else if (pathname.startsWith('/embed/')) {
                videoId = pathname.substring('/embed/'.length).split(/[?#]/)[0];
            } else if (pathname.startsWith('/shorts/')) {
                videoId = pathname.substring('/shorts/'.length).split(/[?#]/)[0];
                isShorts = true;
            } else if (hostname.includes('googleusercontent.com')) { // 구글 캐시/프록시 URL 처리
                if (hostname.includes('youtube.com')) {
                    // googleusercontent.com URL 내의 경로에서 video ID 추출 로직 (필요시 조정)
                    videoId = pathname.substring(pathname.lastIndexOf('/') + 1).split(/[?#]/)[0];
                    if (pathname.includes('/shorts/')) isShorts = true;
                }
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

// --- Music Item Element Creation ---
export function createMusicItemElement(id, music, currentUser, YOUR_SUPER_ADMIN_UID) {
    const div = document.createElement('div');
    div.className = "music-item bg-gray-50 p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200";
    div.dataset.id = id;

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
    const safeLink1 = music.link1 || '';
    const safeLink2 = music.link2 || '';
    const link1Html = createLinkHtml(safeLink1, 1);
    const link2Html = createLinkHtml(safeLink2, 2);

    let pinnedIndicatorHtml = '';
    if (music.isPinned === true) {
        pinnedIndicatorHtml = `
        <div class="absolute -top-1 -left-1 bg-blue-400 text-white w-5 h-5 rounded-full shadow flex items-center justify-center" title="고정됨 (최근 고정일: ${music.pinnedAt ? new Date(music.pinnedAt.seconds * 1000).toLocaleString() : '시간 정보 없음'})">
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

    if (currentUser && currentUser.uid === YOUR_SUPER_ADMIN_UID) {
        addAdminControls(div, id, music);
    }
    return div;
}


// --- Modal Controls ---
export function openAddModal() {
    addMusicForm.reset();
    addMusicMessage.textContent = '';
    addMusicModal.classList.remove('hidden');
    addMusicModal.classList.add('modal-active');
    document.body.classList.add('modal-active');
}

export function closeAddModal() {
    addMusicForm.reset();
    addMusicMessage.textContent = '';
    addMusicModal.classList.add('hidden');
    addMusicModal.classList.remove('modal-active');
    document.body.classList.remove('modal-active');
}

export function openEditModal(docId, musicData) {
    currentEditingDocId = docId;
    editMusicIdInput.value = docId;
    editMusicTitleInput.value = musicData.title || '';
    editMusicUrlInput.value = musicData.url || '';
    editMusicDescriptionInput.value = musicData.description || '';
    editMusicLink1Input.value = musicData.link1 || '';
    editMusicLink2Input.value = musicData.link2 || '';

    const editMusicCreatedAtInput = document.getElementById('editMusicCreatedAt');
    // 'createdAt' 필드가 있고, Firestore 날짜 형식이 맞는지 확인 (안전장치)
    if (musicData.createdAt && musicData.createdAt.toDate) {
        editMusicCreatedAtInput.value = formatToDateTimeLocalString(musicData.createdAt.toDate());
    } else {
        editMusicCreatedAtInput.value = ''; // 필드가 없으면 빈 값으로 설정
    }

    editMusicMessage.textContent = '';
    editMusicModal.classList.remove('hidden');
    editMusicModal.classList.add('modal-active');
    document.body.classList.add('modal-active');
}

export function closeEditModal() {
    editMusicForm.reset();
    editMusicMessage.textContent = '';
    editMusicModal.classList.add('hidden');
    editMusicModal.classList.remove('modal-active');
    document.body.classList.remove('modal-active');
    currentEditingDocId = null;
}

export async function handleEditFormSubmit(event) {
    event.preventDefault();
    if (!currentEditingDocId) return;

    const updateButton = document.getElementById('updateMusicButton');
    updateButton.disabled = true;
    updateButton.textContent = "업데이트 중...";
    editMusicMessage.textContent = "데이터를 업데이트하고 있습니다...";
    editMusicMessage.className = "mt-4 text-sm text-center text-gray-500";

    const updatedMusic = {
        title: editMusicTitleInput.value.trim(),
        url: editMusicUrlInput.value.trim(),
        description: editMusicDescriptionInput.value.trim(),
        link1: editMusicLink1Input.value.trim(),
        link2: editMusicLink2Input.value.trim(),
    };

    const createdAtValue = document.getElementById('editMusicCreatedAt').value;
    // 날짜 입력 필드에 값이 있을 때만 updatedMusic 객체에 createdAt 속성을 추가
    if (createdAtValue) {
        updatedMusic.createdAt = new Date(createdAtValue);
    }

    if (!updatedMusic.title) {
        editMusicMessage.textContent = "곡 제목은 필수입니다.";
        editMusicMessage.className = "mt-4 text-sm text-center text-red-500";
        updateButton.disabled = false;
        updateButton.textContent = "업데이트";
        return;
    }

    try {
        const musicDocRef = doc(db, "musicbox", currentEditingDocId);
        await updateDoc(musicDocRef, updatedMusic);

        editMusicMessage.textContent = "음악 정보가 성공적으로 업데이트되었습니다!";
        editMusicMessage.className = "mt-4 text-sm text-center text-green-500";
        setTimeout(() => {
            closeEditModal();
            loadAndDisplayMusicData();
        }, 1500);

    } catch (error) {
        console.error("데이터 업데이트 실패: ", error);
        editMusicMessage.textContent = "데이터 업데이트에 실패했습니다: " + error.message;
        editMusicMessage.className = "mt-4 text-sm text-center text-red-500";
    } finally {
        updateButton.disabled = false;
        updateButton.textContent = "업데이트";
    }
}


// --- Admin Controls (Dropdown Menu) ---
function addAdminControls(itemElement, musicId, musicData) {
    if (itemElement.querySelector('.admin-controls-container')) {
        const moreButton = itemElement.querySelector('.more-options-button');
        if (moreButton) {
            const newMoreButton = moreButton.cloneNode(true);
            moreButton.parentNode.replaceChild(newMoreButton, moreButton);
            newMoreButton.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleDropdownMenu(event.currentTarget, musicId, musicData);
            });
        }
        return;
    }

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
    moreButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDropdownMenu(event.currentTarget, musicId, musicData);
    });

    controlsContainer.appendChild(moreButton);
    itemElement.appendChild(controlsContainer);
}

function createDropdownMenu(musicId, musicData) {
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';

    const isCurrentlyPinned = musicData.isPinned === true;

    const pinButton = document.createElement('button');
    pinButton.textContent = isCurrentlyPinned ? '고정 해제' : '고정하기';
    pinButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeAnyOpenDropdown();
        try {
            const musicDocRef = doc(db, "musicbox", musicId);
            await updateDoc(musicDocRef, {
                isPinned: !isCurrentlyPinned,
                pinnedAt: !isCurrentlyPinned ? serverTimestamp() : null
            });
            console.log(`문서 ${musicId} 고정 상태 변경됨`);
            loadAndDisplayMusicData();
        } catch (error) {
            console.error("고정 상태 업데이트 실패:", error);
            alert("고정 상태 변경 중 오류가 발생했습니다.");
        }
    });

    const editButton = document.createElement('button');
    editButton.textContent = '수정';
    editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(musicId, musicData);
        closeAnyOpenDropdown();
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '삭제';
    deleteButton.className = 'delete-option';
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteMusic(musicId, musicData.title);
        closeAnyOpenDropdown();
    });

    menu.appendChild(pinButton);
    menu.appendChild(editButton);
    menu.appendChild(deleteButton);
    return menu;
}

function toggleDropdownMenu(buttonElement, musicId, musicData) {
    closeAnyOpenDropdown(buttonElement.nextSibling);

    let dropdown = buttonElement.nextSibling;
    if (dropdown && dropdown.classList.contains('dropdown-menu')) {
        dropdown.remove();
        currentOpenDropdown = null;
    } else {
        dropdown = createDropdownMenu(musicId, musicData);
        buttonElement.parentNode.appendChild(dropdown);
        currentOpenDropdown = dropdown;
    }
}

export function closeAnyOpenDropdown(excludeMenu = null) {
    if (currentOpenDropdown && currentOpenDropdown !== excludeMenu) {
        currentOpenDropdown.remove();
        currentOpenDropdown = null;
    }
}

async function handleDeleteMusic(docId, musicTitle = "해당 곡") {
    if (confirm(`"${musicTitle}" 음악을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
        try {
            const musicDocRef = doc(db, "musicbox", docId);
            await deleteDoc(musicDocRef);
            console.log("문서 삭제 완료:", docId);
            loadAndDisplayMusicData();
            alert(`"${musicTitle}"이(가) 삭제되었습니다.`);
        } catch (error) {
            console.error("문서 삭제 실패: ", error);
            alert("삭제 중 오류가 발생했습니다: " + error.message);
        }
    }
}