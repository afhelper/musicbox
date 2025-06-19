// auth.js
import { auth } from './firebase.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/**
 * 이메일과 비밀번호로 로그인을 시도하는 함수
 * @param {string} email - 로그인할 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<UserCredential>} 로그인 성공 시 UserCredential 객체를 포함하는 Promise
 */
export function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

/**
 * 현재 사용자를 로그아웃시키는 함수
 * @returns {Promise<void>} 로그아웃 Promise
 */
export function logout() {
    return signOut(auth);
}

/**
 * 사용자의 로그인 상태 변경을 감지하는 리스너를 등록하는 함수
 * @param {function} callback - 로그인 상태가 변경될 때 호출될 콜백 함수 (user 객체를 인자로 받음)
 * @returns {function} 리스너를 해제하는 함수
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Firebase Auth 에러 코드를 사용자에게 보여줄 한글 메시지로 변환하는 함수
 * @param {string} errorCode - Firebase Auth 에러 코드
 * @returns {string} 사용자에게 보여줄 에러 메시지
 */
export function mapAuthError(errorCode) {
    switch (errorCode) {
        case "auth/invalid-email": return "잘못된 이메일 형식입니다.";
        case "auth/user-disabled": return "사용 중지된 계정입니다.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "비밀번호가 올바르지 않습니다.";
        case "auth/too-many-requests": return "너무 많은 요청이 있었습니다. 잠시 후 다시 시도해주세요.";
        case "auth/network-request-failed": return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
        case "auth/captcha-check-failed": return "reCAPTCHA 인증에 실패했습니다.";
        default: return "알 수 없는 오류가 발생했습니다. (" + errorCode + ")";
    }
}