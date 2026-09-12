// moli小手机 - SillyTavern 第三方扩展入口
// 结构参考常见 ST 第三方扩展：直接导入 ST 官方 API，再初始化自己的模块。

import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

import { initApp } from "./src/core/app.js";

const EXT_ID = "fourth-wall-phone";

const defaultSettings = {
    enabled: true,
};

async function initMoliPhone() {
    console.log("[moli小手机] 开始初始化");

    if (!extension_settings[EXT_ID]) {
        extension_settings[EXT_ID] = structuredClone(defaultSettings);
        saveSettingsDebounced();
    }

    if (extension_settings[EXT_ID].enabled === false) {
        console.log("[moli小手机] 已在设置中关闭");
        return;
    }

    try {
        initApp();
        console.log("[moli小手机] 初始化完成");
        window.toastr?.success?.("moli小手机已加载");
    } catch (error) {
        console.error("[moli小手机] 初始化失败", error);
        window.toastr?.error?.(`moli小手机加载失败：${error?.message || error}`);
        throw error;
    }
}

// 与常见 ST 第三方扩展一致：等待 jQuery ready 后初始化。
jQuery(async () => {
    await initMoliPhone();
});
