// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp, doc, updateDoc, deleteDoc, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBeIPr1H_de7eIZUagNAUvPbw-rYRteP9U", // 너의 Firebase API 키
    authDomain: "submit-33eb1.firebaseapp.com", // 너의 Firebase Auth 도메인
    projectId: "submit-33eb1", // 너의 Firebase 프로젝트 ID
    storageBucket: "submit-33eb1.appspot.com", // 너의 Firebase 스토리지 버킷
    messagingSenderId: "123176179541", // 너의 Firebase 메시징 발신자 ID
    appId: "1:123176179541:web:c40f2392c8b95fb93601dc" // 너의 Firebase 앱 ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase 모듈 초기화 완료");

// 다른 파일에서 사용할 수 있도록 export
export {
    auth,
    db,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    collection,
    addDoc,
    query,
    orderBy,
    getDocs,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    limit,      // <-- [추가]
    startAfter  // <-- [추가]
};