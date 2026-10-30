chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0] || {};
  document.getElementById("title").value = tab.title || "Captured tab";
  document.getElementById("text").value = `${tab.title || ""}\n${tab.url || ""}`;
  document.getElementById("go").addEventListener("click", () => {
    const title = document.getElementById("title").value;
    const text = document.getElementById("text").value;
    const url = tab.url || "";
    const target = new URL("https://jiuwendemos.github.io/recall/");
    target.hash = `/share-target?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    chrome.tabs.create({ url: target.toString() });
  });
});
