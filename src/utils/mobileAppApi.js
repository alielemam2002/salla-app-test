/**
 * Client-side API client for Mobile App Generator
 */

async function callMobileAppApi(payload) {
  const response = await fetch("/api/mobile-app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    return {
      success: false,
      status: response.status,
      code: "invalid_response",
      error: "رد غير متوقع من الخادم",
    };
  }

  return data;
}

export async function fetchMobileAppConfig(token) {
  return await callMobileAppApi({
    token,
    action: "mobile_app_get",
  });
}

export async function saveMobileAppConfig(token, config) {
  return await callMobileAppApi({
    token,
    action: "mobile_app_save",
    config,
  });
}

export async function triggerMobileAppBuild(token) {
  return await callMobileAppApi({
    token,
    action: "mobile_app_build",
  });
}

export async function fetchMobileAppStatus(token, buildId = null) {
  return await callMobileAppApi({
    token,
    action: "mobile_app_status",
    buildId,
  });
}

export async function cancelMobileAppBuild(token) {
  return await callMobileAppApi({
    token,
    action: "mobile_app_cancel",
  });
}

export async function sendPushNotification(token, { title, body, url = null }) {
  return await callMobileAppApi({
    token,
    action: "mobile_app_push_send",
    title,
    body,
    url,
  });
}

export async function fetchPushHistory(token) {
  return await callMobileAppApi({
    token,
    action: "mobile_app_push_history",
  });
}

