// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// 네가 이전에 사용하던 Firebase 설정 정보야.
// 나중에 이 부분은 .env 파일로 분리해서 관리하면 더 안전해!
const firebaseConfig = {
    apiKey: "AIzaSyBeIPr1H_de7eIZUagNAUvPbw-rYRteP9U", // 너의 Firebase API 키
    authDomain: "submit-33eb1.firebaseapp.com", // 너의 Firebase Auth 도메인
    projectId: "submit-33eb1", // 너의 Firebase 프로젝트 ID
    storageBucket: "submit-33eb1.appspot.com", // 너의 Firebase 스토리지 버킷
    messagingSenderId: "123176179541", // 너의 Firebase 메시징 발신자 ID
    appId: "1:123176179541:web:c40f2392c8b95fb93601dc" // 너의 Firebase 앱 ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig); //

// 다른 모듈에서 인증(auth)과 데이터베이스(db)를 사용할 수 있도록 export 해주는 거야.
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase 모듈 초기화 완료");