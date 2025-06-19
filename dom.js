// dom.js
// document.getElementById 로 HTML 요소를 가져오는 코드를 모두 모아두는 파일이야.

// --- 로그인 관련 요소 ---
export const loginFormContainer = document.getElementById('loginFormContainer');
export const passwordInput = document.getElementById('password');
export const loginButton = document.getElementById('loginButton');
export const messageDiv = document.getElementById('message');

// --- 메인 데이터 섹션 ---
export const dataSectionDiv = document.getElementById('dataSection');
export const musicListContainer = document.getElementById('musicListContainer');

// --- 음악 추가 모달 관련 요소 ---
export const addMusicModal = document.getElementById('addMusicModal');
export const closeAddMusicModalButton = document.getElementById('closeAddMusicModalButton');
export const cancelAddMusicButton = document.getElementById('cancelAddMusicButton');
export const addMusicForm = document.getElementById('addMusicForm');
export const saveMusicButton = document.getElementById('saveMusicButton');
export const addMusicMessage = document.getElementById('addMusicMessage');

// --- 음악 수정 모달 관련 요소 ---
export const editMusicModal = document.getElementById('editMusicModal');
export const closeEditMusicModalButton = document.getElementById('closeEditMusicModalButton');
export const cancelEditMusicButton = document.getElementById('cancelEditMusicButton');
export const editMusicForm = document.getElementById('editMusicForm');
export const editMusicMessage = document.getElementById('editMusicMessage');
export const editMusicIdInput = document.getElementById('editMusicId');
export const editMusicTitleInput = document.getElementById('editMusicTitle');
export const editMusicUrlInput = document.getElementById('editMusicUrl');
export const editMusicDescriptionInput = document.getElementById('editMusicDescription');
export const editMusicLink1Input = document.getElementById('editMusicLink1');
export const editMusicLink2Input = document.getElementById('editMusicLink2');
export const updateMusicButton = document.getElementById('updateMusicButton');


// --- 플로팅 액션 버튼 (FAB) 관련 요소 ---
export const fabContainer = document.getElementById('fabContainer');
export const fabButton = document.getElementById('fabButton');
export const fabIconPlus = document.getElementById('fabIconPlus');
export const fabIconClose = document.getElementById('fabIconClose');
export const fabActions = document.getElementById('fabActions');
export const openAddMusicFab = document.getElementById('openAddMusicFab');
export const logoutFab = document.getElementById('logoutFab');