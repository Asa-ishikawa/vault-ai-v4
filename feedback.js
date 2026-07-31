alert("feedback.jsは読み込まれています");
// ===============================
// 跳び箱AI採点システム Ver5.2
// feedback.js
// ===============================


// ----------------------------
// 評価表示
// ----------------------------
function showFeedback(result) {


    const area =
    document.getElementById("feedback");


    if(!area){

        console.error(
            "feedback表示エリアがありません"
        );

        return;

    }



    if(!result){

        area.innerHTML =
        "評価データがありません";

        return;

    }



    const details =
    result.details;



    let html = "";



    html += `
    <h3>🏃 AI評価結果</h3>

    <h2>
    Dスコア：
    ${result.score.toFixed(1)}
    </h2>
    `;



    html += `
    <div class="feedback-item">

    <h4>🦵 膝の伸び</h4>

    <p>
    ${details.knee.text}
    </p>

    <strong>
    ${details.knee.score}/2点
    </strong>

    </div>
    `;



    html += `
    <div class="feedback-item">

    <h4>⬆️ 腰の高さ</h4>

    <p>
    ${details.hip.text}
    </p>

    <strong>
    ${details.hip.score}/2点
    </strong>

    </div>
    `;



    html += `
    <div class="feedback-item">

    <h4>👐 着手位置</h4>

    <p>
    ${details.hand.text}
    </p>

    <strong>
    ${details.hand.score}/2点
    </strong>

    </div>
    `;



    html += `
    <div class="feedback-item">

    <h4>🚀 両足踏切</h4>

    <p>
    ${details.takeOff.text}
    </p>

    <strong>
    ${details.takeOff.score}/2点
    </strong>

    </div>
    `;



    html += `
    <div class="feedback-item">

    <h4>🧍 着地</h4>

    <p>
    ${details.landing.text}
    </p>

    <strong>
    ${details.landing.score}/2点
    </strong>

    </div>
    `;



    area.innerHTML = html;


}



// ----------------------------
// 公開
// ----------------------------

console.log("feedback.js 読み込み成功");

window.showFeedback =
showFeedback;