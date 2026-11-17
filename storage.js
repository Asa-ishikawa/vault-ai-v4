
// ============================================================
// 跳び箱AI採点システム
// storage.js Ver9.0
// IndexedDBによる採点結果保存
// ============================================================

(function () {

    "use strict";

    const DB_NAME = "VaultingBoxAI";
    const DB_VERSION = 1;
    const STORE_NAME = "results";

    let dbPromise = null;

    // --------------------------------------------------------
    // データベースを開く
    // --------------------------------------------------------

    function openDatabase() {

        if (dbPromise) {
            return dbPromise;
        }

        dbPromise = new Promise((resolve, reject) => {

            if (!window.indexedDB) {
                reject(
                    new Error("このブラウザはIndexedDBに対応していません。")
                );
                return;
            }

            const request = indexedDB.open(
                DB_NAME,
                DB_VERSION
            );

            request.onupgradeneeded = function (event) {

                const database = event.target.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {

                    const store = database.createObjectStore(
                        STORE_NAME,
                        {
                            keyPath: "id",
                            autoIncrement: true
                        }
                    );

                    store.createIndex(
                        "studentName",
                        "studentName",
                        { unique: false }
                    );

                    store.createIndex(
                        "date",
                        "date",
                        { unique: false }
                    );
                }
            };

            request.onsuccess = function () {
                resolve(request.result);
            };

            request.onerror = function () {
                dbPromise = null;
                reject(request.error);
            };

            request.onblocked = function () {
                reject(
                    new Error("データベースが別の画面で使用されています。")
                );
            };
        });

        return dbPromise;
    }

    // --------------------------------------------------------
    // 保存
    // --------------------------------------------------------

    async function saveResult(data) {

        const database = await openDatabase();

        return new Promise((resolve, reject) => {

            const transaction = database.transaction(
                STORE_NAME,
                "readwrite"
            );

            const store = transaction.objectStore(STORE_NAME);

            const request = store.add(data);

            request.onsuccess = function () {
                resolve(request.result);
            };

            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    // --------------------------------------------------------
    // 全件取得
    // --------------------------------------------------------

    async function getAllResults() {

        const database = await openDatabase();

        return new Promise((resolve, reject) => {

            const transaction = database.transaction(
                STORE_NAME,
                "readonly"
            );

            const store = transaction.objectStore(STORE_NAME);

            const request = store.getAll();

            request.onsuccess = function () {

                const results = request.result || [];

                results.sort((a, b) => {
                    return String(b.savedAt).localeCompare(
                        String(a.savedAt)
                    );
                });

                resolve(results);
            };

            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    // --------------------------------------------------------
    // 1件削除
    // --------------------------------------------------------

    async function deleteResult(id) {

        const database = await openDatabase();

        return new Promise((resolve, reject) => {

            const transaction = database.transaction(
                STORE_NAME,
                "readwrite"
            );

            const store = transaction.objectStore(STORE_NAME);

            const request = store.delete(Number(id));

            request.onsuccess = function () {
                resolve(true);
            };

            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    // --------------------------------------------------------
    // 公開
    // --------------------------------------------------------

    window.VaultStorage = {
        saveResult,
        getAllResults,
        deleteResult
    };

    console.log("storage.js Ver9.0 読み込み成功");

})();
