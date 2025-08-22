// ui.js
import { db, doc, updateDoc, deleteDoc, serverTimestamp } from './firebase.js';
import { loadAndDisplayMusicData } from './app.js'; // 순환 참조를 피하기 위해 app.js에서 함수를 가져옴


export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}



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


// 👇 [추가] 2단계: 새로운 오디오 플레이어 로직
const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};


const setupPlayer = ({ audio, playBtn, progressContainer, progress, currentTimeEl, durationEl }) => {
    let isPlaying = false;

    const togglePlay = () => {
        isPlaying ? audio.pause() : audio.play();
    };

    playBtn.addEventListener('click', togglePlay);

    audio.addEventListener('play', () => {
        isPlaying = true;
        const icon = playBtn.querySelector('i');
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    });

    audio.addEventListener('pause', () => {
        isPlaying = false;
        const icon = playBtn.querySelector('i');
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    });

    const updateDisplay = () => {
        if (!audio.duration) return;

        const progressPercent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${progressPercent}%`;

        currentTimeEl.textContent = formatTime(audio.currentTime);
    };

    audio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audio.duration);
        updateDisplay();
    });

    audio.addEventListener('timeupdate', updateDisplay);

    progressContainer.addEventListener('click', (e) => {
        if (!isPlaying) return;

        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = (clickX / rect.width) * audio.duration;
        audio.currentTime = newTime;
    });
};




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
            // 각 오디오 요소와 플레이어 UI 요소에 고유 ID를 부여 (id 변수 활용)
            playerHtml = `
            <div class="my-3 bg-white p-4 rounded-lg shadow-md">
                <audio id="audioSource-${id}" src="${musicUrl}" preload="metadata" class="hidden"></audio>
                <div class="flex items-center space-x-4">
                    <button id="playBtn-${id}" class="w-12 h-12 flex-shrink-0 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 transition shadow-lg">
                        <i class="fas fa-play text-lg"></i>
                    </button>
                    <div class="w-full relative">
                        <div id="progress-container-${id}" class="progress-container bg-gray-200 rounded-full h-4 w-full cursor-pointer">
                            <div id="progress-${id}" class="progress-bar bg-indigo-500 h-4 rounded-full w-0"></div>
                        </div>
                        <div class="absolute w-full text-xs text-gray-500 mt-1 flex justify-between">
                            <span id="currentTime-${id}">0:00</span>
                            <span id="duration-${id}">0:00</span>
                        </div>
                    </div>
                </div>
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

    // 컨트롤 영역(공유 버튼은 모두에게, 관리 버튼은 관리자에게만)
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'admin-controls-container';

    // 모든 사용자가 볼 수 있는 공유 버튼
    const shareButton = document.createElement('button');
    shareButton.className = 'share-button control-button';
    shareButton.title = '공유하기';
    shareButton.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.932 2.186 2.25 2.25 0 0 0-3.932-2.186m0-12.986a2.25 2.25 0 1 0 3.932-2.186 2.25 2.25 0 0 0-3.932 2.186" />
</svg>
    `;
    shareButton.addEventListener('click', (event) => {
        event.stopPropagation();
        handleShareClick(id);
    });
    controlsContainer.appendChild(shareButton);

    // 관리자만 볼 수 있는 더보기(수정/삭제/고정) 버튼
    if (currentUser && currentUser.uid === YOUR_SUPER_ADMIN_UID) {
        const moreButton = document.createElement('button');
        moreButton.className = 'more-options-button control-button';
        moreButton.title = '더 보기';
        moreButton.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>
        `;
        moreButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleDropdownMenu(event.currentTarget, id, music);
        });
        controlsContainer.appendChild(moreButton);
    }

    div.appendChild(controlsContainer);


    if (musicUrl && /\.(mp3|m4a|ogg|wav|aac)$/i.test(musicUrl)) {
        setupPlayer({
            audio: div.querySelector(`#audioSource-${id}`),
            playBtn: div.querySelector(`#playBtn-${id}`),
            progressContainer: div.querySelector(`#progress-container-${id}`),
            progress: div.querySelector(`#progress-${id}`),
            currentTimeEl: div.querySelector(`#currentTime-${id}`),
            durationEl: div.querySelector(`#duration-${id}`),
        });
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
    // 👇 [1단계-2] 수정할 때도 제목을 키워드로 분해해서 업데이트
    updatedMusic.keywords = updatedMusic.title.toLowerCase().split(' ').filter(word => word.length > 0);

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
        
        // 👇 수정된 항목만 업데이트
        const musicItemElement = document.querySelector(`.music-item[data-id="${currentEditingDocId}"]`);
        if (musicItemElement) {
            // 기존 요소를 새로운 요소로 교체
            const newMusicItemElement = createMusicItemElement(currentEditingDocId, updatedMusic, /* currentUser */ null, /* YOUR_SUPER_ADMIN_UID */ null);
            musicItemElement.replaceWith(newMusicItemElement);
        }
        
        setTimeout(() => {
            closeEditModal();
            // 👇 전체 새로고침 대신 토스트 메시지 표시
            showToast("게시글이 성공적으로 업데이트되었습니다!", "success");
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
    // 이미 컨트롤이 있으면 버튼의 이벤트 리스너만 새로고침 (기존과 동일)
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
        // 공유 버튼도 리스너 새로고침
        const shareButton = itemElement.querySelector('.share-button');
        if (shareButton) {
            const newShareButton = shareButton.cloneNode(true);
            shareButton.parentNode.replaceChild(newShareButton, shareButton);
            newShareButton.addEventListener('click', (event) => {
                event.stopPropagation();
                handleShareClick(musicId);
            });
        }
        return;
    }

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'admin-controls-container';

    // 👇 [추가] 공유 버튼
    const shareButton = document.createElement('button');
    shareButton.className = 'share-button control-button'; // 공통 스타일을 위한 control-button 클래스 추가
    shareButton.title = '공유하기';
    shareButton.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.932 2.186 2.25 2.25 0 0 0-3.932-2.186m0-12.986a2.25 2.25 0 1 0 3.932-2.186 2.25 2.25 0 0 0-3.932 2.186" />
</svg>
    `;
    shareButton.addEventListener('click', (event) => {
        event.stopPropagation();
        handleShareClick(musicId);
    });

    // 기존 더보기 버튼
    const moreButton = document.createElement('button');
    moreButton.className = 'more-options-button control-button'; // 공통 스타일을 위한 control-button 클래스 추가
    moreButton.title = '더 보기';
    moreButton.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>
    `;
    moreButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDropdownMenu(event.currentTarget, musicId, musicData);
    });

    controlsContainer.appendChild(shareButton); // 공유 버튼을 먼저 추가
    controlsContainer.appendChild(moreButton); // 그 다음에 더보기 버튼 추가
    itemElement.appendChild(controlsContainer);
}


// 👇 [추가] 공유 버튼 클릭을 처리할 별도 함수
function handleShareClick(musicId) {
    // #post/ID 형태의 주소 생성
    const postUrl = `${window.location.origin}${window.location.pathname}#post/${musicId}`;

    // 최신 브라우저에서 지원하는 navigator.clipboard API 사용
    navigator.clipboard.writeText(postUrl).then(() => {
        // 성공 시 토스트 메시지 표시
        showToast('게시물 주소가 복사되었습니다.', 'success');
    }).catch(err => {
        // 실패 시 에러 메시지와 토스트 메시지 표시
        console.error('URL 복사 실패:', err);
        showToast('주소 복사에 실패했습니다.', 'error');
    });
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
            loadAndDisplayMusicData(true);
        } catch (error) {
            console.error("고정 상태 업데이트 실패:", error);
            showToast("고정 상태 변경 중 오류가 발생했습니다.");
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
            loadAndDisplayMusicData(true);
            showToast(`"${musicTitle}"이(가) 삭제되었습니다.`);
        } catch (error) {
            console.error("문서 삭제 실패: ", error);
            showToast("삭제 중 오류가 발생했습니다: " + error.message);
        }
    }
}
