// moli小手机 —— 最小加载诊断
// 不调用任何 src 文件，不调用设置，不调用 API。
// 只验证 SillyTavern 有没有真正执行这个 index.js。

jQuery(async () => {
    console.log("[moli小手机] index.js 已执行");

    // 防止重复
    document.getElementById("moli-load-test")?.remove();

    const test = document.createElement("button");
    test.id = "moli-load-test";
    test.textContent = "moli加载成功";

    Object.assign(test.style, {
        position: "fixed",
        right: "20px",
        top: "120px",
        zIndex: "2147483647",
        padding: "14px 18px",
        border: "0",
        borderRadius: "12px",
        background: "#07c160",
        color: "#ffffff",
        fontSize: "16px",
        fontWeight: "700",
        boxShadow: "0 6px 24px rgba(0,0,0,.35)"
    });

    document.body.appendChild(test);

    test.addEventListener("click", () => {
        alert("moli小手机 index.js 正在正常运行！");
    });
});
