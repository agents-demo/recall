import ReactDOM from "react-dom/client";
import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./styles.css";
import "./styles-more.css";
import "./styles-v1.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// The booth and the stage must work with the network unplugged once the shell is installed.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline caching is an enhancement; the pack is already local */
    });
  });
}
