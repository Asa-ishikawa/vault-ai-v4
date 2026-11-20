
// ============================================================
// 跳び箱AI採点システム
// excel.js Ver10.0
//
// Excel出力機能
// ・現在の表示条件で出力
// ・選択クラスのみ出力
// ・全クラス出力
// ・採点記録一覧
// ・評価項目詳細
// ・クラス集計
//
// Ver10.0
// ・台上前転の5項目に対応
// ・判定保留の記録に対応
// ・判定保留を平均点に含めない
// ・既存の開脚跳び・閉脚跳びの記録に対応
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
    // null・undefined・空欄を0にしない
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
    // 判定状態
    // --------------------------------------------------------

    function getJudgmentStatus(record) {

        if (record.skill === "台上前転") {

            return record.isComplete === true
                ? "判定完了"
                : "判定保留";

        }

        return "判定完了";

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


        const filtered = records.filter(record => {

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

            const aScore = getNumber(a.totalScore);
            const bScore = getNumber(b.totalScore);

            switch (sortMode) {

                case "dateAsc":
                    return String(a.savedAt || a.date || "")
                        .localeCompare(
                            String(b.savedAt || b.date || "")
                        );

                case "scoreDesc":

                    if (aScore === null && bScore === null) return 0;
                    if (aScore === null) return 1;
                    if (bScore === null) return -1;

                    return bScore - aScore;

                case "scoreAsc":

                    if (aScore === null && bScore === null) return 0;
                    if (aScore === null) return 1;
                    if (bScore === null) return -1;

                    return aScore - bScore;

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
    // 技ごとの評価項目
    // --------------------------------------------------------

    function getCriteria(record) {

        if (record.skill === "台上前転") {

            return [
                {
                    key: "takeOff",
                    label: "踏切"
                },
                {
                    key: "handContact",
                    label: "着手"
                },
                {
                    key: "rotation",
                    label: "回転"
                },
                {
                    key: "bodyPass",
                    label: "体の通過"
                },
                {
                    key: "landing",
                    label: "着地"
                }
            ];

        }

        return [
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
            "判定状態",
            "Dスコア",
            "Eスコア",
            "総合得点",
            "暫定得点",
            "判定済み項目数",
            "判定保留項目数",
            "保存日時"
        ];


        const rows = records.map(record => [

            getClassName(record),

            getDate(record),

            record.studentName || "",

            record.skill || "",

            getJudgmentStatus(record),

            getNumber(record.dScore),

            getNumber(record.eScore),

            getNumber(record.totalScore),

            getNumber(record.provisionalScore),

            getNumber(record.judgedCount),

            getNumber(record.unknownCount),

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

        const header = [
            "クラス",
            "実施日",
            "生徒名",
            "技",
            "判定状態",
            "Dスコア",
            "Eスコア",
            "総合得点"
        ];


        // 技ごとに異なる項目を、5枠で統一して出力
        for (let i = 1; i <= 5; i++) {

            header.push(
                `評価項目${i} 名称`,
                `評価項目${i} 得点`,
                `評価項目${i} 判定状態`,
                `評価項目${i} 評価内容`,
                `評価項目${i} 測定値・検出情報`
            );

        }


        header.push(
            "総合コメント",
            "踏切フレーム",
            "着手フレーム",
            "回転開始フレーム",
            "回転終了フレーム",
            "体の通過フレーム",
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

                getJudgmentStatus(record),

                getNumber(record.dScore),

                getNumber(record.eScore),

                getNumber(record.totalScore)

            ];


            const criteria = getCriteria(record);


            criteria.forEach(item => {

                const detail = details[item.key] || {};

                const score = getNumber(detail.score);

                const status = detail.status ||
                    (score === null ? "判定不能" : "判定済み");

                let measured = "";


                if (record.skill === "台上前転") {

                    const confidence =
                        getNumber(detail.confidence);

                    const frame =
                        detail.frame ?? "";

                    const parts = [];

                    if (frame !== "") {
                        parts.push(`フレーム：${frame}`);
                    }

                    if (confidence !== null) {
                        parts.push(
                            `信頼度：${confidence.toFixed(2)}`
                        );
                    }

                    measured = parts.join(" / ");

                } else {

                    if (
                        detail.measured !== null &&
                        detail.measured !== undefined
                    ) {
                        measured = String(detail.measured);
                    }

                    if (
                        detail.value !== null &&
                        detail.value !== undefined
                    ) {
                        measured = measured
                            ? `${measured} / ${detail.value}`
                            : String(detail.value);
                    }

                }


                row.push(
                    item.label,
                    score,
                    status,
                    detail.text || detail.reason || "",
                    measured
                );

            });


            // 項目数が5未満の場合の空欄補充
            for (
                let i = criteria.length;
                i < 5;
                i++
            ) {

                row.push("", null, "", "", "");

            }


            const phase = record.phase || {};
            const detected = phase.detected || {};

            const getFrame = key => {

                const event = detected[key];

                if (
                    event &&
                    typeof event === "object"
                ) {
                    return event.frame ?? "";
                }

                return event ?? "";

            };


            row.push(
                record.totalComment || "",

                record.skill === "台上前転"
                    ? getFrame("takeOff")
                    : phase.takeOff ?? "",

                record.skill === "台上前転"
                    ? getFrame("handContact")
                    : phase.handContact ?? "",

                getFrame("rotationStart"),

                getFrame("rotationEnd"),

                getFrame("bodyPass"),

                phase.highestHip ?? "",

                record.skill === "台上前転"
                    ? getFrame("landing")
                    : phase.landing ?? ""
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
    // 判定保留の記録は平均・最高・最低に含めない
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
            "確定記録数",
            "判定保留記録数",
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

                scores.length,

                classRecords.length - scores.length,

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


        // ----------------------------------------------------
        // シート1：採点記録一覧
        // ----------------------------------------------------

        const recordSheet =
            createRecordSheet(records);

        setColumnWidths(
            recordSheet,
            [
                16, 13, 16, 14, 14, 12,
                12, 12, 12, 16, 16, 24
            ]
        );

        XLSX.utils.book_append_sheet(
            workbook,
            recordSheet,
            "採点記録一覧"
        );


        // ----------------------------------------------------
        // シート2：評価項目詳細
        // ----------------------------------------------------

        const detailSheet =
            createDetailSheet(records);

        const detailWidths = [
            16, 13, 16, 14, 14, 12, 12, 12
        ];

        for (let i = 0; i < 5; i++) {
            detailWidths.push(
                16, 12, 14, 32, 24
            );
        }

        detailWidths.push(
            40, 14, 14, 16, 16, 16, 18, 14
        );

        setColumnWidths(
            detailSheet,
            detailWidths
        );

        XLSX.utils.book_append_sheet(
            workbook,
            detailSheet,
            "評価項目詳細"
        );


        // ----------------------------------------------------
        // シート3：クラス集計
        // ----------------------------------------------------

        const summarySheet =
            createSummarySheet(records);

        setColumnWidths(
            summarySheet,
            [18, 14, 16, 14, 18, 14, 14, 14]
        );

        XLSX.utils.book_append_sheet(
            workbook,
            summarySheet,
            "クラス集計"
        );


        // ----------------------------------------------------
        // ファイル名
        // ----------------------------------------------------

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
        "Ver10.0：台上前転対応Excel出力プログラム読み込み成功"
    );

    console.log(
        "excel.js Ver10.0 読み込み成功"
    );

})();
