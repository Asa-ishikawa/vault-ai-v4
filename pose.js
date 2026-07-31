// ===============================
// 跳び箱AI採点システム Ver5.2
// pose.js
// ===============================


// MediaPipe Pose
let pose = null;


// 動画・Canvas
let videoElement = null;
let canvasElement = null;
let canvasCtx = null;


// 骨格履歴
let poseHistory = [];


// 最終評価結果
let latestScoreResult = null;


// ----------------------------
// Pose開始
// ----------------------------
async function startPose(video, canvas, ctx) {


    videoElement = video;
    canvasElement = canvas;
    canvasCtx = ctx;


    // データ初期化
    poseHistory = [];
    latestScoreResult = null;



    if (!pose) {


        pose = new Pose({

            locateFile:(file)=>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`

        });



        pose.setOptions({

            modelComplexity:1,

            smoothLandmarks:true,

            enableSegmentation:false,

            minDetectionConfidence:0.5,

            minTrackingConfidence:0.5

        });



        pose.onResults(onResults);


    }



    analyze();


}



// ----------------------------
// 動画解析
// ----------------------------
async function analyze(){


    if(
        videoElement.paused ||
        videoElement.ended
    ){

        finishPoseAnalysis();

        return;

    }



    await pose.send({

        image:videoElement

    });



    requestAnimationFrame(analyze);


}



// ----------------------------
// Pose結果
// ----------------------------
function onResults(results){



    canvasCtx.clearRect(

        0,
        0,
        canvasElement.width,
        canvasElement.height

    );



    if(!results.poseLandmarks){

        return;

    }



    // 骨格保存
    poseHistory.push({


        time:
        videoElement.currentTime,


        landmarks:
        results.poseLandmarks


    });



    // 骨格線
    drawConnectors(

        canvasCtx,

        results.poseLandmarks,

        POSE_CONNECTIONS,

        {

            color:"#00ff00",

            lineWidth:4

        }

    );



    // 関節
    drawLandmarks(

        canvasCtx,

        results.poseLandmarks,

        {

            color:"#ff0000",

            radius:5

        }

    );


}



// ----------------------------
// 解析終了
// ----------------------------
function finishPoseAnalysis(){



    console.log(

        "保存フレーム:",
        poseHistory.length

    );



    if(
        typeof calculateDScore === "function"
    ){



        latestScoreResult =
        calculateDScore(
            poseHistory
        );



        // Dスコア表示

        dScore.textContent =
        latestScoreResult.score.toFixed(1);



        // 次の画面表示用保存

        window.latestScoreResult =
        latestScoreResult;


    }



    status.textContent =
    "AI評価完了";


}



// ----------------------------
// 公開
// ----------------------------
window.startPose=startPose;

window.poseHistory=poseHistory;

if(typeof showFeedback === "function"){

    showFeedback(
        latestScoreResult
    );

}