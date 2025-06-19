// firestore-service.js
import { db } from './firebase.js';
import {
    collection,
    addDoc,
    query,
    orderBy,
    getDocs,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const MUSICBOX_COLLECTION = "musicbox";

/**
 * 정렬된 음악 목록 전체를 Firestore에서 가져옵니다.
 * @returns {Promise<Array<{id: string, data: object}>>} 음악 문서 배열 Promise
 */
export async function getMusicList() {
    const musicCollectionRef = collection(db, MUSICBOX_COLLECTION);
    const q = query(musicCollectionRef,
        orderBy("isPinned", "desc"),
        orderBy("pinnedAt", "desc"),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    // doc.id와 doc.data()를 함께 배열로 만들어 반환
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
    }));
}

/**
 * 새로운 음악을 Firestore에 추가합니다.
 * @param {object} musicData - { title, url, description, link1, link2, userId }
 * @returns {Promise<DocumentReference>} 추가된 문서의 참조 Promise
 */
export function addMusic(musicData) {
    return addDoc(collection(db, MUSICBOX_COLLECTION), {
        ...musicData,
        createdAt: serverTimestamp(),
        isPinned: false,
        pinnedAt: null
    });
}

/**
 * 기존 음악 정보를 Firestore에서 업데이트합니다.
 * @param {string} docId - 업데이트할 문서 ID
 * @param {object} updatedData - { title, url, description, link1, link2 }
 * @returns {Promise<void>} 업데이트 Promise
 */
export function updateMusic(docId, updatedData) {
    const musicDocRef = doc(db, MUSICBOX_COLLECTION, docId);
    return updateDoc(musicDocRef, updatedData);
}

/**
 * 음악 문서를 Firestore에서 삭제합니다.
 * @param {string} docId - 삭제할 문서 ID
 * @returns {Promise<void>} 삭제 Promise
 */
export function deleteMusic(docId) {
    const musicDocRef = doc(db, MUSICBOX_COLLECTION, docId);
    return deleteDoc(musicDocRef);
}

/**
 * 음악 문서의 고정 상태를 업데이트합니다.
 * @param {string} docId - 업데이트할 문서 ID
 * @param {boolean} isPinned - 새로운 고정 상태 (true or false)
 * @returns {Promise<void>} 업데이트 Promise
 */
export function togglePinStatus(docId, isPinned) {
    const musicDocRef = doc(db, MUSICBOX_COLLECTION, docId);
    return updateDoc(musicDocRef, {
        isPinned: isPinned,
        pinnedAt: isPinned ? serverTimestamp() : null
    });
}