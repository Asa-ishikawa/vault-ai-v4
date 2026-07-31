// ===============================
// 跳び箱AI採点システム Ver5.2
// score.js
// ===============================


// ----------------------------
// 角度計算
// ----------------------------
function getAngle(a, b, c) {

    const ab = {
        x: a.x - b.x,
        y: a.y - b.y
    };

    const cb = {
        x: c.x - b.x,
        y: c.y - b.y
    };


    const dot =
        ab.x * cb.x +
        ab.y * cb.y;


    const magAB =
        Math.sqrt(
            ab.x * ab.x +
            ab.y * ab.y
        );


    const magCB =
        Math.sqrt(
            cb.x * cb.x +
            cb.y * cb.y
        );


    if (magAB === 0 || magCB === 0) {
        return 0;
    }


    let cos =
        dot /
        (magAB * magCB);


    cos =
        Math.max(
            -1,
            Math.min(
                1,
                cos
            )
        );


    return Math.acos(cos) * 180 / Math.PI;

}



// ===============================
// 両足踏切
// ===============================
function evaluateTakeOff(history) {


    let result = {

        score:0,
        text:"両足踏切を確認できません"

    };


    if(history.length < 10){

        return result;

    }


    let left = null;
    let right = null;



    for(let i = 1; i < history.length; i++){


        const before =
            history[i-1].landmarks;


        const after =
            history[i].landmarks;



        const leftMove =
            before[27].y -
            after[27].y;


        const rightMove =
            before[28].y -
            after[28].y;



        if(
            leftMove > 0.01 &&
            left === null
        ){

            left = i;

        }


        if(
            rightMove > 0.01 &&
            right === null
        ){

            right = i;

        }

    }



    if(
        left === null ||
        right === null
    ){

        return result;

    }



    const diff =
        Math.abs(left-right);



    if(diff <= 3){

        result.score = 2;
        result.text =
        "左右の足がほぼ同時に離れています";

    }
    else{

        result.score = 1;
        result.text =
        "踏切のタイミングに少し差があります";

    }



    return result;

}



// ===============================
// 着手位置
// ===============================
function evaluateHandPlacement(frame){


    const shoulder =
    (
        frame[11].y +
        frame[12].y
    ) / 2;


    const hand =
    (
        frame[15].y +
        frame[16].y
    ) / 2;


    if(hand > shoulder){

        return {

            score:2,

            text:
            "適切な位置で手をついています"

        };

    }


    return {

        score:1,

        text:
        "手の位置を少し調整すると安定します"

    };

}



// ===============================
// 膝の伸び
// ===============================
function evaluateKneeExtension(frame){


    const left =
    getAngle(
        frame[23],
        frame[25],
        frame[27]
    );


    const right =
    getAngle(
        frame[24],
        frame[26],
        frame[28]
    );


    const avg =
    (left+right)/2;



    if(avg >=160){

        return {

            score:2,

            text:
            `膝が伸びています（${avg.toFixed(0)}°）`

        };

    }


    if(avg>=140){

        return {

            score:1,

            text:
            `膝が少し曲がっています（${avg.toFixed(0)}°）`

        };

    }



    return {

        score:0,

        text:
        `膝の伸びを意識しましょう（${avg.toFixed(0)}°）`

    };

}



// ===============================
// 腰の高さ
// ===============================
function evaluateHipHeight(frame){


    const shoulder =
    (
        frame[11].y+
        frame[12].y
    )/2;


    const hip =
    (
        frame[23].y+
        frame[24].y
    )/2;



    if(hip < shoulder){

        return {

            score:2,

            text:
            "腰が高く上がっています"

        };

    }



    return {

        score:1,

        text:
        "腰を高く保つ意識が必要です"

    };

}



// ===============================
// 着地安定
// ===============================
function evaluateLanding(history){


    let movement = 0;


    const last =
    history.slice(-5);



    for(let i=1;i<last.length;i++){


        movement += Math.abs(

            last[i].landmarks[24].y -
            last[i-1].landmarks[24].y

        );

    }



    if(movement < 0.05){

        return {

            score:2,

            text:
            "着地後の姿勢が安定しています"

        };

    }


    if(movement <0.15){

        return {

            score:1,

            text:
            "着地後に少し動きがあります"

        };

    }



    return {

        score:0,

        text:
        "着地姿勢を安定させましょう"

    };

}



// ===============================
// Dスコア計算
// ===============================
function calculateDScore(history){


    if(
        !history ||
        history.length===0
    ){

        return 0;

    }



    const middle =
    history[
        Math.floor(history.length/2)
    ].landmarks;



    const takeOff =
    evaluateTakeOff(history);


    const hand =
    evaluateHandPlacement(middle);


    const knee =
    evaluateKneeExtension(middle);


    const hip =
    evaluateHipHeight(middle);


    const landing =
    evaluateLanding(history);



    const result = {


        score:
        takeOff.score+
        hand.score+
        knee.score+
        hip.score+
        landing.score,


        details:{


            takeOff:takeOff,

            hand:hand,

            knee:knee,

            hip:hip,

            landing:landing


        }

    };



    console.log(result);



    return result;

}



// ===============================
// 公開
// ===============================
window.getAngle=getAngle;

window.calculateDScore=
calculateDScore;