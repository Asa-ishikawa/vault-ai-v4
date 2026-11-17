
// ============================================================
// 跳び箱AI採点システム
// excel.js Ver9.2
//
// Excel出力機能
// ・現在の表示条件で出力
// ・選択クラスのみ出力
// ・全クラス出力
// ・採点記録一覧
// ・評価項目詳細
// ・クラス集計
//
// 既存の採点ロジック・保存データ構造は変更しない
// ============================================================

(function () {

    "use strict";

    const exportButton =
        document.getElementById("exportExcelBtn");

    const exportScope =
        document.getElementById("excelExportScope");

    const statusElement =
        document.getElementById("excelExportStatus");

    const filterClass =
        document.getElementById("filterClass");

    const searchStudent =
        document.getElementById("searchStudent");

    const filterSkill =
        document.getElementById("filterSkill");

    const sortResults =
        document.getElementById("sortResults");


    // --------------------------------------------------------
    // 状態表示
    // --------------------------------------------------------

    function setStatus(message, success = true) {

        if (!statusElement) return;

        statusElement.textContent = message;

        statusElement.style.color = success
            ? "#176b35"
            : "#b00020";

    }


    // --------------------------------------------------------
    // クラス名取得
    // --------------------------------------------------------

    function getClassName(record) {

        const value = String(
            record.className || ""
        ).trim();

        return value || "未設定";

    }


    // --------------------------------------------------------
    // 数値変換
    // --------------------------------------------------------

    function getNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;

    }


    // --------------------------------------------------------
    // 日付取得
    // --------------------------------------------------------

    function getDate(record) {

        if (record.date) {
            return String(record.date);
        }

        if (record.savedAt) {
            return String(record.savedAt).split("T")[0];
        }

        return "";

    }


    // --------------------------------------------------------
    // 表示条件による絞り込み
    // --------------------------------------------------------

    function getFilteredRecords(records) {

        const selectedClass =
            filterClass?.value || "";

        const searchName =
            searchStudent?.value.trim().toLowerCase() || "";

        const selectedSkill =
            filterSkill?.value || "";

        const sortMode =
            sortResults?.value || "dateDesc";


        let filtered = records.filter(record => {

            if (
                selectedClass &&
                getClassName(record) !== selectedClass
            ) {
                return false;
            }

            if (
                searchName &&
                !String(record.studentName || "")
                    .toLowerCase()
                    .includes(searchName)
            ) {
                return false;
            }

            if (
                selectedSkill &&
                record.skill !== selectedSkill
            ) {
                return false;
            }

            return true;

        });


        filtered.sort((a, b) => {

            switch (sortMode) {

                case "dateAsc":
                    return String(a.savedAt || a.date || "")
                        .localeCompare(
                            String(b.savedAt || b.date || "")
                        );

                case "scoreDesc":
                    return (
                        (getNumber(b.totalScore) || 0) -
                        (getNumber(a.totalScore) || 0)
                    );

                case "scoreAsc":
                    return (
                        (getNumber(a.totalScore) || 0) -
                        (getNumber(b.totalScore) || 0)
                    );

                case "nameAsc":
                    return String(a.studentName || "")
                        .localeCompare(
                            String(b.studentName || ""),
                            "ja"
                        );

                case "dateDesc":
                default:
                    return String(b.savedAt || b.date || "")
                        .localeCompare(
                            String(a.savedAt || a.date || "")
                        );

            }

        });

        return filtered;

    }


    // --------------------------------------------------------
    // 出力対象の決定
    // --------------------------------------------------------

    function selectExportRecords(allRecords) {

        const scope = exportScope?.value || "currentView";

        if (scope === "all") {

            return allRecords;

        }


        if (scope === "selectedClass") {

            const selected = filterClass?.value || "";

            if (!selected) {

                throw new Error(
                    "先に「表示するクラス」でクラスを選択してください。"
                );

            }

            return allRecords.filter(record =>
                getClassName(record) === selected
            );

        }


        return getFilteredRecords(allRecords);

    }


    // --------------------------------------------------------
    // シート1：採点記録一覧
    // --------------------------------------------------------

    function createRecordSheet(records) {

        const header = [
            "クラス",
            "実施日",
            "生徒名",
            "技",
            "Dスコア",
            "Eスコア",
            "総合得点",
            "保存日時"
        ];

        const rows = records.map(record => [

            getClassName(record),

            getDate(record),

            record.studentName || "",

            record.skill || "",

            getNumber(record.dScore),

            getNumber(record.eScore),

            getNumber(record.totalScore),

            record.savedAt || ""

        ]);

        return XLSX.utils.aoa_to_sheet([
            header,
            ...rows
        ]);

    }


    // --------------------------------------------------------
    // シート2：評価項目詳細
    // --------------------------------------------------------

    function createDetailSheet(records) {

        const criteria = [
            {
                key: "takeOff",
                label: "両足踏切"
            },
            {
                key: "hand",
                label: "着手位置"
            },
            {
                key: "hip",
                label: "腰の位置"
            },
            {
                key: "knee",
                label: "膝の伸び"
            },
            {
                key: "landing",
                label: "着地の安定"
            }
        ];


        const header = [
            "クラス",
            "実施日",
            "生徒名",
            "技",
            "Dスコア",
            "Eスコア",
            "総合得点"
        ];


        criteria.forEach(item => {

            header.push(
                item.label + " 得点"
            );

            header.push(
                item.label + " 評価内容"
            );

            header.push(
                item.label + " 測定値"
            );

        });


        header.push(
            "総合コメント",
            "踏切フレーム",
            "着手フレーム",
            "腰最高点フレーム",
            "着地フレーム"
        );


        const rows = records.map(record => {

            const details = record.details || {};

            const row = [

                getClassName(record),

                getDate(record),

                record.studentName || "",

                record.skill || "",

                getNumber(record.dScore),

                getNumber(record.eScore),

                getNumber(record.totalScore)

            ];


            criteria.forEach(item => {

                const detail = details[item.key] || {};

                row.push(
                    getNumber(detail.score)
                );

                row.push(
                    detail.text || ""
                );

                row.push(
                    detail.measured === null ||
                    detail.measured === undefined
                        ? ""
                        : String(detail.measured)
                );

            });


            const phase = record.phase || {};

            row.push(
                record.totalComment || "",
                phase.takeOff ?? "",
                phase.handContact ?? "",
                phase.highestHip ?? "",
                phase.landing ?? ""
            );

            return row;

        });


        return XLSX.utils.aoa_to_sheet([
            header,
            ...rows
        ]);

    }


    // --------------------------------------------------------
    // シート3：クラス集計
    // --------------------------------------------------------

    function createSummarySheet(records) {

        const groups = new Map();


        records.forEach(record => {

            const className = getClassName(record);

            if (!groups.has(className)) {

                groups.set(className, []);

            }

            groups.get(className).push(record);

        });


        const header = [
            "クラス",
            "記録人数",
            "採点記録数",
            "平均得点",
            "最高得点",
            "最低得点"
        ];


        const rows = [];

        const classNames = [...groups.keys()]
            .sort((a, b) => a.localeCompare(b, "ja"));


        classNames.forEach(className => {

            const classRecords = groups.get(className);

            const students = new Set(
                classRecords
                    .map(record =>
                        String(record.studentName || "").trim()
                    )
                    .filter(Boolean)
            );


            const scores = classRecords
                .map(record => getNumber(record.totalScore))
                .filter(score => score !== null);


            const average = scores.length > 0
                ? Number(
                    (
                        scores.reduce(
                            (sum, score) => sum + score,
                            0
                        ) / scores.length
                    ).toFixed(1)
                )
                : null;


            const maximum = scores.length > 0
                ? Math.max(...scores)
                : null;


            const minimum = scores.length > 0
                ? Math.min(...scores)
                : null;


            rows.push([

                className,

                students.size,

                classRecords.length,

                average,

                maximum,

                minimum

            ]);

        });


        return XLSX.utils.aoa_to_sheet([
            header,
            ...rows
        ]);

    }


    // --------------------------------------------------------
    // 列幅を調整
    // --------------------------------------------------------

    function setColumnWidths(sheet, widths) {

        sheet["!cols"] = widths.map(width => ({
            wch: width
        }));

    }


    // --------------------------------------------------------
    // Excelファイル作成
    // --------------------------------------------------------

    async function exportExcel() {

        if (!window.VaultStorage) {

            throw new Error(
                "保存プログラムが読み込まれていません。"
            );

        }

        if (
            typeof XLSX === "undefined" ||
            !XLSX.utils
        ) {

            throw new Error(
                "Excel作成ライブラリを読み込めませんでした。インターネット接続を確認してください。"
            );

        }


        setStatus(
            "保存済みの採点記録を読み込んでいます..."
        );


        const allRecords =
            await window.VaultStorage.getAllResults();


        if (allRecords.length === 0) {

            throw new Error(
                "Excelに出力できる採点記録がありません。"
            );

        }


        const records =
            selectExportRecords(allRecords);


        if (records.length === 0) {

            throw new Error(
                "出力対象の採点記録がありません。"
            );

        }


        setStatus(
            "Excelファイルを作成しています..."
        );


        const workbook = XLSX.utils.book_new();


        // シート1
        const recordSheet =
            createRecordSheet(records);

        setColumnWidths(
            recordSheet,
            [16, 13, 16, 14, 12, 12, 12, 24]
        );

        XLSX.utils.book_append_sheet(
            workbook,
            recordSheet,
            "採点記録一覧"
        );


        // シート2
        const detailSheet =
            createDetailSheet(records);

        setColumnWidths(
            detailSheet,
            [
                16, 13, 16, 14, 12, 12, 12,
                13, 30, 18,
                13, 30, 18,
                13, 30, 18,
                13, 30, 18,
                13, 30, 18,
                40, 14, 14, 18, 14
            ]
        );

        XLSX.utils.book_append_sheet(
            workbook,
            detailSheet,
            "評価項目詳細"
        );


        // シート3
        const summarySheet =
            createSummarySheet(records);

        setColumnWidths(
            summarySheet,
            [18, 14, 16, 14, 14, 14]
        );

        XLSX.utils.book_append_sheet(
            workbook,
            summarySheet,
            "クラス集計"
        );


        // ファイル名
        const now = new Date();

        const dateString =
            now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, "0") +
            String(now.getDate()).padStart(2, "0");


        const scope = exportScope?.value || "currentView";

        let scopeName = "表示条件";

        if (scope === "all") {
            scopeName = "全クラス";
        }

        if (scope === "selectedClass") {
            scopeName =
                filterClass?.value || "選択クラス";
        }


        const safeScopeName = scopeName.replace(
            /[\\/:*?"<>|]/g,
            "_"
        );


        const filename =
            `跳び箱AI採点記録_${safeScopeName}_${dateString}.xlsx`;


        XLSX.writeFile(
            workbook,
            filename
        );


        setStatus(
            `Excel出力が完了しました。${records.length}件の記録を出力しました。`
        );

    }


    // --------------------------------------------------------
    // ボタン
    // --------------------------------------------------------

    if (exportButton) {

        exportButton.addEventListener(
            "click",
            async () => {

                exportButton.disabled = true;

                try {

                    await exportExcel();

                } catch (error) {

                    console.error(
                        "Excel出力エラー:",
                        error
                    );

                    setStatus(
                        "Excel出力エラー：" + error.message,
                        false
                    );

                    alert(
                        "Excelを出力できませんでした。\n\n" +
                        error.message
                    );

                } finally {

                    exportButton.disabled = false;

                }

            }
        );

    }


    // --------------------------------------------------------
    // 初期化
    // --------------------------------------------------------

    setStatus(
        "Ver9.2：Excel出力プログラム読み込み成功"
    );

    console.log(
        "excel.js Ver9.2 読み込み成功"
    );

})();
