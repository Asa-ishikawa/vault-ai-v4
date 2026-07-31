// ===============================
// 跳び箱AI採点システム Ver5.2
// app.js
// ===============================


// ----------------------------
// 要素取得
// ----------------------------

const videoFile =
document.getElementById("videoFile");

const video =
document.getElementById("video");

const canvas =
document.getElementById("outputCanvas");

const ctx =
canvas.getContext("2d");


const detectBtn =
document.getElementById("detectBtn");


const status =
document.getElementById("status");


const dScore =
document.getElementById("dScore");


const eScore =
document.getElementById("eScore");


const totalScore =
document.getElementById("totalScore");



// ----------------------------
// 動画選択
// ----------------------------

videoFile.addEventListener(
"change",
()=>{


    const file =
    videoFile.files[0];


    if(!file){

        return;

    }


    const url =
    URL.createObjectURL(file);


    video.src =
    url;


    status.textContent =
    "動画を読み込み中...";


});




// ----------------------------
// 動画サイズ設定
// ----------------------------

video.addEventListener(
"loadedmetadata",
()=>{


    canvas.width =
    video.videoWidth;


    canvas.height =
    video.videoHeight;


});




// ----------------------------
// 読み込み完了
// ----------------------------

video.addEventListener(
"loadeddata",
()=>{


    canvas.style.width =
    video.clientWidth+"px";


    canvas.style.height =
    video.clientHeight+"px";


    status.textContent =
    "動画の読み込み完了";


});




// ----------------------------
// AI開始
// ----------------------------

detectBtn.addEventListener(
"click",
async()=>{


    if(!video.src){


        alert(
        "動画を選択してください"
        );


        return;

    }



    detectBtn.disabled =
    true;


    detectBtn.textContent =
    "AI解析中...";



    status.textContent =
    "AI解析中...";


    dScore.textContent =
    "-";


    totalScore.textContent =
    "-";



    const feedback =
    document.getElementById(
        "feedback"
    );


    if(feedback){

        feedback.innerHTML =
        "解析中...";

    }



    video.currentTime =
    0;



    try{


        await video.play();


        startPose(
            video,
            canvas,
            ctx
        );



    }
    catch(error){


        console.error(error);


        status.textContent =
        "動画再生エラー";


        resetButton();


    }



});




// ----------------------------
// 動画終了
// ----------------------------

video.addEventListener(
"ended",
()=>{


    finishAnalysis();


});




// ----------------------------
// 解析終了
// ----------------------------

function finishAnalysis(){



    status.textContent =
    "AI評価完了";



    detectBtn.disabled =
    false;


    detectBtn.textContent =
    "AI骨格検出開始";



    // 評価結果表示

    if(
        window.latestScoreResult !== null &&
    window.latestScoreResult !== undefined
    ){


        const result =
        window.latestScoreResult;



        dScore.textContent =
        result.score.toFixed(1);



        if(
            typeof showFeedback
            === "function"
        ){


            showFeedback(
                result
            );


        }


    }


    updateTotal();


}



// ----------------------------
// ボタン復帰
// ----------------------------

function resetButton(){


    detectBtn.disabled =
    false;


    detectBtn.textContent =
    "AI骨格検出開始";


}



// ----------------------------
// Eスコア変更
// ----------------------------

eScore.addEventListener(
"input",
updateTotal
);




// ----------------------------
// 合計点
// ----------------------------

function updateTotal(){



    const d =
    Number(
        dScore.textContent
    );



    const e =
    Number(
        eScore.value
    );



    if(
        isNaN(d)
    ){


        totalScore.textContent =
        "-";


        return;

    }



    totalScore.textContent =
    (
        d + e
    ).toFixed(1);



}