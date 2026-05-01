"use strict";

const exportButton = document.getElementById("exportButton");
const statusNode = document.getElementById("status");
const autoScrollNode = document.getElementById("autoScroll");
const includeMetadataNode = document.getElementById("includeMetadata");

function setStatus(message) {
  statusNode.textContent = message;
}

function getFilename(title) {
  const cleanTitle = (title || "chatgpt-conversation")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const date = new Date().toISOString().slice(0, 10);
  return `${cleanTitle || "chatgpt-conversation"}-${date}.md`;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function requestConversationExport(tabId, options) {
  const message = {
    type: "EXPORT_CHATGPT_MARKDOWN",
    options
  };

  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function exportConversation() {
  exportButton.disabled = true;
  setStatus("Collecting conversation...");

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || "")) {
      throw new Error("Open a ChatGPT conversation tab first.");
    }

    const response = await requestConversationExport(tab.id, {
      autoScroll: autoScrollNode.checked,
      includeMetadata: includeMetadataNode.checked
    });

    if (!response?.ok) {
      throw new Error(response?.error || "The page did not return an export.");
    }

    const blob = new Blob([response.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url,
      filename: getFilename(response.title),
      saveAs: true
    });

    setStatus(`Exported ${response.messageCount} messages.`);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (error) {
    setStatus(error.message || "Export failed.");
  } finally {
    exportButton.disabled = false;
  }
}

exportButton.addEventListener("click", exportConversation);
