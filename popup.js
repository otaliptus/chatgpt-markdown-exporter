"use strict";

const exportButton = document.getElementById("exportButton");
const statusNode = document.getElementById("status");
const formatNode = document.getElementById("format");
const autoScrollNode = document.getElementById("autoScroll");
const includeMetadataNode = document.getElementById("includeMetadata");

const FORMAT_CONFIG = {
  markdown: {
    label: "Markdown",
    extension: "md",
    mime: "text/markdown;charset=utf-8"
  },
  latex: {
    label: "LaTeX",
    extension: "tex",
    mime: "text/x-tex;charset=utf-8"
  }
};

function setStatus(message) {
  statusNode.textContent = message;
}

function selectedFormat() {
  return FORMAT_CONFIG[formatNode.value] ? formatNode.value : "markdown";
}

function getFilename(title, format) {
  const config = FORMAT_CONFIG[format] || FORMAT_CONFIG.markdown;
  const cleanTitle = (title || "chatgpt-conversation")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const date = new Date().toISOString().slice(0, 10);
  return `${cleanTitle || "chatgpt-conversation"}-${date}.${config.extension}`;
}

function updateFormatUi() {
  const config = FORMAT_CONFIG[selectedFormat()];
  exportButton.textContent = `Download ${config.label}`;
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
  const format = selectedFormat();
  const config = FORMAT_CONFIG[format];
  setStatus("Collecting conversation...");

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || "")) {
      throw new Error("Open a ChatGPT conversation tab first.");
    }

    const response = await requestConversationExport(tab.id, {
      format,
      autoScroll: autoScrollNode.checked,
      includeMetadata: includeMetadataNode.checked
    });

    if (!response?.ok) {
      throw new Error(response?.error || "The page did not return an export.");
    }

    const exportContent = response.content || response.markdown;
    if (!exportContent) {
      throw new Error("The page returned an empty export.");
    }

    const blob = new Blob([exportContent], { type: config.mime });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url,
      filename: getFilename(response.title, format),
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

formatNode.addEventListener("change", updateFormatUi);
exportButton.addEventListener("click", exportConversation);
updateFormatUi();
